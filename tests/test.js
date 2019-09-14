"use strict";

const assert = require("assert");
const fs = require("fs");
const { resolve } = require("path");
const exec = require("child_process").exec;

const ethers = require("ethers");
const { solc } = require("@ethersproject/cli");

const Takoyaki = require("./takoyaki");

const ens = require("./ens");
const { SourceMapper } = require("./source-mapper");

// Start Parity in dev mode:
//   /home/ricmoo> echo "\n" > test.pwds
//   /home/ricmoo> parity --config dev-insecure --unlock=0x00a329c0648769a73afac7f9381e08fb43dbea72 --password test.pwds -d ./test

let provider = null;
let admin = null;
let ABI = null;
let wallet = null;
let takoyakiContract = null;

const GRACE_PERIOD = 2;
const REGISTRATION_PERIOD = 12;
const MAX_COMMIT_BLOCKS = 10;
const WAIT_CANCEL_BLOCKS = 16;
const DEFAULT_FEE = ethers.utils.parseEther("0.1");

const fastForward = nMinutes => {
  return new Promise((resolve, reject) => {
    exec(`sudo date -s "${nMinutes} minutes"`, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout);
    });
  });
};

before(async function() {
    // Compile Takoyaki Registrar
    console.log("Compiling TakoyakiRegistrar...");
    let source = fs.readFileSync(resolve(__dirname, "../contracts/TakoyakiRegistrar.sol")).toString();

    let sourceMapper = new SourceMapper(source);
    sourceMapper.set("MIN_COMMIT_BLOCKS", null);
    sourceMapper.set("MAX_COMMIT_BLOCKS", `${MAX_COMMIT_BLOCKS}`);
    sourceMapper.set("WAIT_CANCEL_BLOCKS", `${WAIT_CANCEL_BLOCKS}`);
    sourceMapper.set("REGISTRATION_PERIOD", "(12 minutes)");
    sourceMapper.set("GRACE_PERIOD", "(2 minutes)");

    let warnings = sourceMapper.warnings;
    if (warnings.length) {
        console.log(warnings);
        warnings.forEach((warning) =>{
            console.log("[Source Mapper] " + warning.line);
        });
        throw new Error("Errors during source mapping.");
    }

    let code = null;
    try {
        code = solc.compile(sourceMapper.source, {
            optimize: true
        }).filter((contract) => (contract.name === "TakoyakiRegistrar"))[0];
    } catch (e) {
        console.log(e);
        e.errors.forEach((error) => {
            console.log(error);
        });
        throw new Error("Failed to compile TakoyakiRegistrar.sol");
    }
    ABI = code.interface;

    // Compile Wallet
    console.log("Compiling Wallet...");
    const walletSource = fs.readFileSync(resolve(__dirname, "../contracts/Wallet.sol")).toString();

    let walletSourceMapper = new SourceMapper(walletSource);
    let walletCode = null;
    try {
        walletCode = solc.compile(walletSourceMapper.source, {
            optimize: true
        }).filter((contract) => (contract.name === "Wallet"))[0];
    } catch (e) {
        e.errors.forEach((error) => {
            console.log(error);
        });
        throw new Error("Failed to compile Wallet.sol");
    }

    // Deploy ENS
    console.log("Deploying ENS...");
    provider = await ens.prepareProvider("http://localhost:8545");
    let ensAddress = await provider.getNetwork().then((network) => network.ensAddress);

    // Fund the admin account
    admin = await ens.createSigner(provider);

    // @TODO: support this in ethers
    let defaultResolver = await provider.resolveName("resolver.eth");

    // Deploy Takoyaki Registrar
    console.log("Deploying TakoyakiRegistrar...");
    let contractFactory = new ethers.ContractFactory(ABI, code.bytecode, admin);
    let contract = await contractFactory.deploy(ensAddress, ethers.utils.namehash("takoyaki.eth"), defaultResolver, {
        gasLimit: 4300000
    });
    await contract.deployed();

    // Give takoyaki.eth to the Takoyaki Registrar (as the owner and resolver)
    await provider.register("takoyaki.eth", contract.address, contract.address);
    takoyakiContract = Takoyaki.connect(provider);

    // Deploy Wallet contract
    console.log("Deploying Wallet...");
    const walletFactory = new ethers.ContractFactory(walletCode.interface, walletCode.bytecode, admin);
    wallet = await walletFactory.deploy({ gasLimit: 4300000 });
    await wallet.deployed();

});

describe("Check Config", async function() {

    let expected = {
        "ens()":      () => (provider.getNetwork().then((network) => network.ensAddress)),
        "nodehash()": () => (ethers.utils.namehash("takoyaki.eth")),

        "admin()":           () => (admin.address),
        "defaultResolver()": () => (provider.resolveName("resolver.eth")),
        "fee()":             () => (ethers.utils.parseEther("0.1")),

        "name()":     () => ("Takoyaki"),
        "symbol()":   () => ("TAKO"),
        "decimals()": () => (0),
    }

    Object.keys(expected).forEach(function(key) {
        it(key, function() {
            let contract = new ethers.Contract("takoyaki.eth", ABI, provider);
            return contract.functions[key]().then((value) => {
                let expectedValue = expected[key]();
                if (!(expectedValue instanceof Promise)) {
                    expectedValue = Promise.resolve(expectedValue);
                }
                return expectedValue.then((expectedValue) => {
                    if (value.eq) {
                         assert.ok(value.eq(expectedValue), `${ key }: ${ value } !== ${ expectedValue }`)
                    } else {
                        assert.equal(value, expectedValue, `${ key }: ${ value } !== ${ expectedValue }`);
                    }
                });
            });
        });
    });

    it("ENS.owner(takoyaki.eth)", async function() {
        let ensAddress = provider.getNetwork().then((network) => network.ensAddress);
        let contract = new ethers.Contract(ensAddress, [ "function owner(bytes32) view returns (address)" ], provider);
        let owner = await contract.owner(ethers.utils.namehash("takoyaki.eth"));
        let resolvedAddress = await provider.resolveName("takoyaki.eth");
        assert.equal(owner, resolvedAddress, "owner is not TakoyakiRegistrar");
    });
});

describe("Admin Tasks", function() {
    describe("Withdraw Funds", function() {
        it("allows admin to withdraw", async function() {
           const takoyaki = Takoyaki.connect(admin);
           const tx = await takoyaki.withdraw("0");
           return assert.doesNotReject(tx.wait().then(receipt => {
              const regex = /^0x[a-f0-9]{64}/;
              assert.ok(regex.test(receipt.transactionHash), "transaction hash is invalid");
           }));
        });

        it("prevents non-admin from  withdrawing", async function() {
           const signer = await provider.createSigner();
           const takoyaki = Takoyaki.connect(signer);
           const tx = await takoyaki.withdraw("0");
           await assert.rejects(tx.wait().then(receipt => {
              assert.fail("non-admin should not be able to withdraw");
           }),
           { code: "CALL_EXCEPTION"});
        });
    });

    describe("Change Admin", function() {
        it("should allow admin to change admin", async function() {
            const signer = await provider.createSigner();
            let takoyaki = Takoyaki.connect(admin);
            let tx = await takoyaki.setAdmin(signer.address);
            await tx.wait();

            const adminAddress = await takoyakiContract.admin();
            assert.strictEqual(adminAddress, signer.address, "new admin address should equal signer address");

            // change admin back
            takoyaki = Takoyaki.connect(signer);
            tx = await takoyaki.setAdmin(admin.address);
            await tx.wait();
        });

        it("should prevent non-admin to change admin", async function() {
            const signer = await provider.createSigner();
            const takoyaki = Takoyaki.connect(signer);
            const tx = await takoyaki.setAdmin(signer.address);
            return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "should not allow non-admin to change admin");
        });
    });

    describe("Change Fee", function() {
        it("should prevent non-admin from changing fee", async function() {
            const signer = await provider.createSigner();
            const takoyaki = Takoyaki.connect(signer);
            const tx = await takoyaki.setFee(ethers.utils.parseEther("1"));
            return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "should not allow non-admin to change fee");
        });
    });

    describe("Change Resolver", function() {
        it("should prevent non-admin from changing resolver", async function() {
            const signer = await provider.createSigner();
            const takoyaki = Takoyaki.connect(signer);
            const tx = await takoyaki.setResolver(signer.address);
            return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "should not allow non-admin to change resolver");
        });
    });
});

describe("Name Registration (happy path)", function() {
    it("can register test.takoyaki.eth (no dust wallet)", async function() {
        const label = "test";
        let signer = await provider.createSigner();
        await Takoyaki.register(provider, signer, label);

        let owner = await provider.resolveName(`${label}.takoyaki.eth`);
        assert.equal(owner, signer.address, `${label}.takoyaki.eth owner is not buyer`);
    });

    it("can register test2.takoyaki.eth (with dust wallet)", async function() {
        let takoyaki = Takoyaki.connect(provider);

        let signerOwner = await provider.createSigner();
        let signerCommit = await provider.createSigner();
        let signerReveal = await provider.createSigner("0.0000000001");

        let salt = ethers.utils.keccak256(ethers.utils.randomBytes(32));

        let txs = await takoyaki.getTransactions("test2", signerOwner.address, salt, signerReveal.address);

        let tx = await signerCommit.sendTransaction(txs.commit);
        let receipt = await tx.wait();
        // @TODO: check logs in receipt

        await provider.mineBlocks(5);

        tx = await signerReveal.sendTransaction(txs.reveal);
        receipt = await tx.wait();
        // @TODO: check logs in receipt

        let owner = await provider.resolveName("test2.takoyaki.eth");
        assert.equal(owner, signerOwner.address, "test2.takoyaki.eth owner is not buyer");
    });

    it("can register punycode 小蜗牛.takoyaki.eth", async function() {
        const label = "小蜗牛";
        const signer = await provider.createSigner("0.22");
        const receipt = await Takoyaki.register(provider, signer, label);

        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.ok(token.status, 2, "status should be registered");
        assert.ok(token.owner, signer.address, "token owner should be signer");
    });
});

describe("Commits and reveals", function() {
    it("should allow multiple commits by different signers", async function() {
        const signer1 = await provider.createSigner();
        const signer2 = await provider.createSigner();
        const label = "dragon";

        let takoyaki = Takoyaki.connect(signer1);
        const blindedCommit1 = await Takoyaki.submitBlindedCommit(
            provider,
            signer1,
            label
        );

        takoyaki = Takoyaki.connect(signer2);
        return assert.doesNotReject(Takoyaki.submitBlindedCommit(
            provider,
            signer2,
            label
        ));

    });

    it("Cannot reveal after MAX_COMMIT_BLOCKS", async function() {
        const label = "boom";
        const signer = await provider.createSigner();
        const takoyaki = Takoyaki.connect(signer);
        const salt = ethers.utils.keccak256(ethers.utils.randomBytes(32));
        const blindedCommit = await takoyaki.makeBlindedCommitment(label, signer.address, salt);

        const fee = await takoyaki.fee(label);
        const options = { value: fee };

        let tx = await takoyaki.commit(blindedCommit, ethers.constants.AddressZero, 0, options);
        let receipt = await tx.wait();

        // fast forward past the max commit blocks
        await provider.mineBlocks(MAX_COMMIT_BLOCKS + 1);

        tx = await takoyaki.reveal(label, signer.address, salt);
        return assert.rejects( tx.wait(), { code: "CALL_EXCEPTION" },
           "Reveal should fail past max commit blocks"
        );
    });

    it("should fail subsequent reveal", async function() {
        const label = "shiny";
        const signer1 = await provider.createSigner("0.22");
        const receipt1 = await Takoyaki.register(provider, signer1, label);

        const signer2 = await provider.createSigner("0.22");

        return assert.rejects(Takoyaki.register(provider, signer2, label),
            { code: "CALL_EXCEPTION" }, "Second registration should fail"
        );
    });

    it("should allow subsequent reveal if the name has expired and past grace period", async function() {
        this.timeout(0);

        const label = "tree";
        let error = null;

        const signer1 = await provider.createSigner("0.22");
        const receipt1 = await Takoyaki.register(provider, signer1, label);

        await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
        await provider.mineBlocks(1);

        const signer2 = await provider.createSigner("0.22");
        return assert.doesNotReject(Takoyaki.register(provider, signer2, label));
    });

    it("should fail subsequent reveal if the name has expired but within grace period", async function() {
        this.timeout(0);

        const label = "treasure";

        const signer1 = await provider.createSigner("0.22");
        const receipt1 = await Takoyaki.register(provider, signer1, label);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        const signer2 = await provider.createSigner("0.22");
        return assert.rejects(Takoyaki.register(provider, signer2, label), {
                code: "CALL_EXCEPTION"
            },
            "Second registration should fail");
    });
});

describe("Renew registration", function() {
  it("can renew after reveal", async function() {
    const label = "bumble";
    const signer = await provider.createSigner("0.22");
    let receipt = await Takoyaki.register(provider, signer, label);

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });
    await tx.wait();

    const token = await takoyaki.getTakoyaki(tokenId);
    assert.equal(
      token.status,
      2,
      `expect status to be 2 but got ${token.status}`
    );
  });

  it("cannot renew an invalid token", async function() {
    const signer = await provider.createSigner();
    const takoyaki = Takoyaki.connect(signer);

    const tokenId = ethers.utils.id("molecule");
    const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });

    return assert.rejects(tx.wait(), { code: 'CALL_EXCEPTION' }, "renew invalid token");
  });

  it("can renew expired token", async function() {
    this.timeout(0);

    const label = "tomato";
    const signer = await provider.createSigner("2");
    const receipt = await Takoyaki.register(provider, signer, label);

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);
    const token = await takoyaki.getTakoyaki(tokenId);

    // fast forward to expire token
    await fastForward(REGISTRATION_PERIOD + 1);
    await provider.mineBlocks(1);

    const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });
    const renewedReceipt = await tx.wait();

    const renewedEvent = Takoyaki.getEvent(takoyaki, renewedReceipt, "Renewed");
    assert.ok(renewedEvent);
    assert.ok(renewedEvent.values.length === 3);

    const newExpiry = token.expires + (REGISTRATION_PERIOD * 60);
    assert.ok(renewedEvent.values[2] === newExpiry, "renew expiry");
  });

  it("cannot renew expired token past grace period", async function() {
    this.timeout(0);

    const label = "carrot";
    const signer = await provider.createSigner("2");
    const receipt = await Takoyaki.register(provider, signer, label);

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    // fast forward to past grace period
    await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
    await provider.mineBlocks(1);

    const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });
    return assert.rejects( tx.wait(), { code: 'CALL_EXCEPTION' }, "renew after grace period");
  });

  it("cannot renew more than 3 times in a row", async function() {
    const label = "cherry";
    const signer = await provider.createSigner("2");
    const receipt = await Takoyaki.register(provider, signer, label);

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    for(let i = 0; i < 2; i++ ) {
       const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });
       await tx.wait();
    }

    const tx = await takoyaki.renew(tokenId, { value: ethers.utils.parseEther("0.1") });
    return assert.rejects( tx.wait(), { code: 'CALL_EXCEPTION' }, "renew after grace period");
  });

  it("cannot renew with different fee", async function() {
    const label = "avocado";
    const signer = await provider.createSigner("2");
    const receipt = await Takoyaki.register(provider, signer, label);

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    const fee = await takoyaki.fee(label);
    const tx = await takoyaki.renew(tokenId, { value: fee.add(1) });
    return assert.rejects( tx.wait(), { code: 'CALL_EXCEPTION' }, "renew fee");
  });
});

describe("Destroy registration", function() {
  it("can destroy after reveal", async function() {
    this.timeout(0);
    const label = "klaus";
    let signer = await provider.createSigner();

    const takoyaki = Takoyaki.connect(signer);
    const receipt = await Takoyaki.register(provider, signer, label);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    // fast forward to past grace period
    await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
    await provider.mineBlocks(1);

    const tx = await takoyaki.destroy(tokenId);
    await tx.wait();

    const token = await takoyaki.getTakoyaki(tokenId);
    assert.equal(
      token.status,
      0,
      `expect status to be 0 but got ${token.status}`
    );
  });

  it("cannot destroy an invalid token", async function() {
    this.timeout(0);
    const label = "heroku";
    let signer = await provider.createSigner();

    const takoyaki = Takoyaki.connect(signer);
    const tokenId = ethers.utils.id(label);

    // fast forward to past grace period
    await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
    await provider.mineBlocks(1);

    const tx = await takoyaki.destroy(tokenId);
    return assert.rejects( tx.wait(),
            { code: "CALL_EXCEPTION" }, "should throw destroying invalid token");

  });

  it("cannot destroy a token during grace period", async function() {
    this.timeout(0);
    const label = "spinning";
    let signer = await provider.createSigner();

    const takoyaki = Takoyaki.connect(signer);
    const receipt = await Takoyaki.register(provider, signer, label);
    const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

    // fast forward to past grace period
    await fastForward(REGISTRATION_PERIOD + 1);
    await provider.mineBlocks(1);

    const tx = await takoyaki.destroy(tokenId);
    return assert.rejects(tx.wait(),
            { code: "CALL_EXCEPTION" }, "should throw destroying token during grace period");

   });
});

describe("syncUpkeepFee()", function() {
    let tokenId = null;
    let owner = null;
    let nonOwner = null;

    before(async function(){
        owner = await provider.createSigner("2");
        nonOwner = await provider.createSigner("2");
        const label = "circle";
        const receipt = await Takoyaki.register(provider, owner, label);
        tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
    });

    after(async function(){
        const takoyaki = Takoyaki.connect(admin);
        const tx = await takoyaki.setFee(DEFAULT_FEE);
        await tx.wait();
    });

    it("should work if called by token owner", async function() {
        let updatedFee = await Takoyaki.syncUpkeepFee(admin, owner, tokenId);
        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.ok(updatedFee && token.upkeepFee.eq(updatedFee), "token should have new upkeep fee");
    });

    it("should work if called by non token owner", async function() {
        const updatedFee = await Takoyaki.syncUpkeepFee(admin, admin, tokenId);
        const token = await takoyakiContract.getTakoyaki(tokenId);

        assert.ok(updatedFee && token.upkeepFee.eq(updatedFee), "token should have new upkeep fee");
    });

    it("should fail for token that has expired", async function() {
        this.timeout(0);

        const originalFee = await takoyakiContract.getTakoyaki(tokenId).then(token => token.upkeepFee);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        await assert.rejects(Takoyaki.syncUpkeepFee(admin, admin, tokenId),
            { code: "CALL_EXCEPTION" }, "Sync fee should fail");

        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.ok(token.upkeepFee.eq(originalFee), "token should have same upkeep fee");
    });

    it("Called for invalid token", async function() {
        const takoyaki = Takoyaki.connect(owner);
        const syncTx = await takoyaki.syncUpkeepFee("333");

        return assert.rejects(syncTx.wait(), { code: "CALL_EXCEPTION" }, "Sync fee should fail");
    });
});

describe("ERC-721 Operations", function() {
    let   signer;
    let   newOwner;

    before(async function(){
        signer = await provider.createSigner("5");
        newOwner = await provider.createSigner("2");
    });

    it(`can get blinded commitment`, async function() {
        const takoyaki = Takoyaki.connect(signer);
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          "starlink"
        );

        const commitment = await takoyaki.getBlindedCommit(blindedCommit);
        assert.equal(commitment.payer, signer.address, "not payer for ens");
        assert.ok(
          commitment.feePaid.eq(ethers.utils.parseEther("0.1")),
          "feePaid mismatch"
        );
    });

    it(`can cancel commitment`, async function() {
        const takoyaki = Takoyaki.connect(signer);
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          "spiderman"
        );

        // can only cancel after n blocks
        await provider.mineBlocks(MAX_COMMIT_BLOCKS + WAIT_CANCEL_BLOCKS);

        const balance = await provider.getBalance(signer.address);

        const tx = await takoyaki.cancelCommitment(blindedCommit);
        const receipt = await tx.wait();

        const cancelEvent = Takoyaki.getEvent(takoyaki, receipt, "Cancelled");
        assert.ok(cancelEvent);
        assert.ok(cancelEvent.values.length === 2);
        assert.equal(
          blindedCommit,
          cancelEvent.values[1],
          "blindedCommit mismatch"
        );

        const newBalance = await provider.getBalance(signer.address);
        assert.ok(newBalance.gt(balance), "balance should be greater");
    });

    it(`Cannot cancel commitment if it had already been cancelled`, async function() {
        const takoyaki = Takoyaki.connect(signer);
        const label = "star";
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          label
        );

        // can only cancel after n blocks
        await provider.mineBlocks(MAX_COMMIT_BLOCKS + WAIT_CANCEL_BLOCKS);

        const tx = await takoyaki.cancelCommitment(blindedCommit);
        const receipt = await tx.wait();

        const tx2 = await takoyaki.cancelCommitment(blindedCommit);
        return assert.rejects(tx2.wait(), { code: "CALL_EXCEPTION" }, "cancellation should fail");

    });

    it(`Cannot cancel commitment if the takoyaki does not have enough balance`, async function() {
        const label = "forces";
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          label
        );

        
        let takoyaki = Takoyaki.connect(admin);
        const balance = await provider.getBalance(takoyaki.address);
        const withdrawTx = await takoyaki.withdraw(balance);
        await withdrawTx.wait();
        
        // can only cancel after n blocks
        await provider.mineBlocks(MAX_COMMIT_BLOCKS + WAIT_CANCEL_BLOCKS);

        takoyaki = Takoyaki.connect(signer);
        const tx = await takoyaki.cancelCommitment(blindedCommit);
        let error = null;
        try {
            await tx.wait();
        } catch (err) {
            error = err;
        }

        assert.ok( error && error.code === "CALL_EXCEPTION", "cancellation should fail");

    });

    it("Cannot cancel commitment before MAX_COMMIT_BLOCKS + MAX_CANCEl_BLOCKS has been mined", async function() {
        const label = "flash";
        const takoyaki = Takoyaki.connect(signer);
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          label
        );

        const tx = await takoyaki.cancelCommitment(blindedCommit);
        let error = null;
        try {
           const receipt = await tx.wait();
        } catch ( err ) {
          error = err;
        }

        assert.ok( error && error.code === "CALL_EXCEPTION", "cancellation should fail");
    });

    it("Cannot cancel commitment after revelation", async function() {
        const label = "gameofthrone";
        const receipt = await Takoyaki.register(provider, signer, label);
        const takoyaki = Takoyaki.connect(signer);
        const salt = await provider.getTransaction(receipt.transactionHash).then(tx => {
            const parsedTx = takoyaki.interface.parseTransaction(tx);
            assert.ok(parsedTx.args.length === 3);
            return parsedTx.args[2];
        });
        const blindedCommit = await takoyaki.makeBlindedCommitment(label, signer.address, salt);
        const tx = await takoyaki.cancelCommitment(blindedCommit);
        let error = null;
        try {
           const receipt = await tx.wait();
        } catch ( err ) {
          error = err;
        }

        assert.ok( error && error.code === "CALL_EXCEPTION", "cancellation should fail");
    });

    it("Cannot cancel commitment owned by others", async function() {
        const label = "champion";
        const blindedCommit = await Takoyaki.submitBlindedCommit(
          provider,
          signer,
          label
        );

        // can only cancel after n blocks
        await provider.mineBlocks(MAX_COMMIT_BLOCKS + WAIT_CANCEL_BLOCKS);

        const takoyaki = Takoyaki.connect(newOwner);
        const tx = await takoyaki.cancelCommitment(blindedCommit);
        let error = null;
        try {
           const receipt = await tx.wait();
        } catch ( err ) {
          error = err;
        }

        assert.ok( error && error.code === "CALL_EXCEPTION", "cancellation should fail");
    });

    it(`can register with correct tokenURI`, async function() {
        const uriPrefix = "https://takoyaki.cafe/json/";
        const label = "zelda";
        const ensName = `${label}.takoyaki.eth`;

        const receipt = await Takoyaki.register(provider, signer, label);

        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const tokenOwner = await takoyakiContract.ownerOf(tokenId);
        assert.equal(tokenOwner, signer.address);

        const tokenURI = await takoyakiContract.tokenURI(tokenId.toHexString());
        assert.equal(
          tokenURI,
          `${uriPrefix}318ae6d0db4a394a61e1e763192966436a00f74c1f87b065808bdb7205125bcc`,
          "tokenURI mismatch"
        );

        const tokenURIFromContract = await takoyakiContract.functions.tokenURI(tokenId);
        assert.equal(
          tokenURIFromContract,
          tokenURI,
          "tokenURI and tokenURIFromContract mismatch"
        );

        const owner = await provider.resolveName(ensName);
        assert.equal(owner, signer.address, `${ensName} owner is not buyer`);
    });

    it('tokenURI should fail for expired token', async function() {
        this.timeout(0);
        const label = "winterfell";
        const ensName = `${label}.takoyaki.eth`;

        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        return assert.rejects(takoyakiContract.functions.tokenURI(tokenId));
    });

    it("can safeTransfer without data", async function() {
        const receipt = await Takoyaki.register(provider, signer, "transfer");
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        // transfer the token to newOwner
        await Takoyaki.safeTransfer(signer, signer, newOwner, tokenId);
        const tokenOwner = await takoyakiContract.ownerOf(tokenId);

        // after transfer, the newOwner should own the token
        assert.equal(tokenOwner, newOwner.address);
    });

    it("can safeTransfer with data", async function() {
        const receipt = await Takoyaki.register(provider, signer, "transferData");
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        // transfer to a wallet contract that can accept data
        // '0xd09de08aj is the call to wallet.increment()
        await Takoyaki.safeTransfer(signer, signer, wallet, tokenId, "0xd09de08a");
        const tokenOwner = await takoyakiContract.ownerOf(tokenId);

        // after transfer, the wallet should own the token
        assert.equal(tokenOwner, wallet.address);

        const count = await wallet.count();
        assert.equal(count, 1, "wallet count should equal 1");
    });

    it("safeTransfer with wrong owner should throw", async function() {
        const receipt = await Takoyaki.register(provider, signer, "wrongOwner");
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        return assert.rejects(Takoyaki.safeTransfer(signer, newOwner, wallet, tokenId),
            { code: "CALL_EXCEPTION" }, "safeTransfer with wrong owner should fail");
    });

    it("safeTransfer by approved operator", async function() {
        const label = "rainbow";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const takoyaki = Takoyaki.connect(owner);
        const tx = await takoyaki.setApprovalForAll(signer.address, true);
        await tx.wait();

        await Takoyaki.safeTransfer(signer, owner, newOwner, tokenId);
        const tokenOwner = await takoyakiContract.ownerOf(tokenId);
        assert.equal(tokenOwner, newOwner.address);
    });

    it("safeTransfer expired token should throw", async function() {
        this.timeout(0);

        const label = "hopeful";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        return assert.rejects(Takoyaki.safeTransfer(signer, signer, newOwner, tokenId),
            { code: "CALL_EXCEPTION" }, "safeTransfer expired token should fail");
    });

    it("safeTransfer to 0 address should throw", async function() {
        const label = "sunny";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const nextOwner = { address: ethers.constants.AddressZero };
        return assert.rejects(Takoyaki.safeTransfer(signer, signer, nextOwner, tokenId),
            { code: "CALL_EXCEPTION" }, "safeTransfer expired token should fail");

    });
});

describe("getTakoyaki", function() {
    it("should return status 1 during grace period", async function() {
        this.timeout(0);

        const signer = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, signer, "grace");

        // fast forward to grace period
        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.equal(token.status, 1, "status should be in grace period");
    });

    it("should return status 2 before expiry", async function() {
        const label = "morning";
        const signer = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, signer, label);

        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.equal(token.status, 2, "registered status 2");
    });

    it("should return status 0 if expired", async function() {
        this.timeout(0);

        const label = "awesome";
        const signer = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, signer, label);

        // fast forward to grace period
        await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
        await provider.mineBlocks(1);

        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
        const token = await takoyakiContract.getTakoyaki(tokenId);
        assert.equal(token.status, 0, "available status 0");
    });
});

describe("Approval", function() {
     it("happy path", async function() {
        const label = "throne";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);

        const takoyaki = Takoyaki.connect(owner);
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);
        let approved = await takoyaki.getApproved(tokenId);
        assert.ok(approved === ethers.constants.AddressZero, "approved should default to zero");

        const newOwner = await provider.createSigner();
        const tx = await takoyaki.approve(newOwner.address, tokenId);
        await tx.wait();
        approved = await takoyaki.getApproved(tokenId);
        assert.ok(approved === newOwner.address, "approved should equal to newOwner");
     });

     it("should fail for non-owner", async function() {
        const label = "perfect";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const nonOwner = await provider.createSigner();
        const newOwner = await provider.createSigner();
        const takoyaki = Takoyaki.connect(nonOwner);
        const tx = await takoyaki.approve(newOwner.address, tokenId);
        return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "approved by non-owner");
     });

     it("should fail for expired token", async function() {
        this.timeout(0);
        const label = "flawless";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        const newOwner = await provider.createSigner();
        const takoyaki = Takoyaki.connect(owner);

        const tx = await takoyaki.approve(newOwner.address, tokenId);
        return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "approve expired token");
     });

     it("should pass for approved non-owner", async function() {
        const label = "impeccable";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const operator = await provider.createSigner("2");
        const signer = await provider.createSigner();

        let takoyaki = Takoyaki.connect(owner);
        let tx = await takoyaki.setApprovalForAll(signer.address, true);
        await tx.wait();

        takoyaki = Takoyaki.connect(signer);
        tx = await takoyaki.approve(operator.address, tokenId);
        const approveReceipt = await tx.wait();

        const approved = await takoyaki.getApproved(tokenId);
        assert.ok(approved === operator.address, "approved should equal operator");

        const approvalEvent = Takoyaki.getEvent(takoyaki, approveReceipt, "Approval");
        assert.ok(approvalEvent);
        assert.ok(approvalEvent.values.length === 3);
        assert.ok(approvalEvent.values[1] === operator.address);
     });

     it("should fail to get approved info for expired token", async function() {
        this.timeout(0);
        const label = "immaculate";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        const operator = await provider.createSigner();
        const takoyaki = Takoyaki.connect(owner);

        let tx = await takoyaki.approve(operator.address, tokenId);
        await tx.wait();

        const approved = await takoyakiContract.getApproved(tokenId);
        assert.ok(approved === operator.address);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        return assert.rejects(takoyakiContract.getApproved(tokenId));
     });
});

describe("Reclaim", function() {
    it("happy path for reclaim", async function() {
        const label = "tennis";
        const tokenName = `${label}.takoyaki.eth`;

        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);

        const takoyaki = Takoyaki.connect(owner);
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

        const newOwner = await provider.createSigner();
        await ens.setOwner(owner, tokenName, newOwner.address);

        let tokenOwner = await ens.getOwner(provider, tokenName);
        assert.strictEqual(tokenOwner, newOwner.address, "address should be new owner");

        await ens.setTTL(newOwner, tokenName, 100);

        const tx = await takoyaki.reclaim(tokenId, owner.address);
        await tx.wait();

        tokenOwner = await ens.getOwner(provider, tokenName);
        assert.strictEqual(tokenOwner, owner.address, "address should be reclaim owner");

        return assert.doesNotReject(ens.setTTL(owner, tokenName, 111));

    });

    it("should fail for non-owner", async function() {
        const label = "winston";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);

        const newOwner = await provider.createSigner();
        const takoyaki = Takoyaki.connect(newOwner);
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

        const tx = await takoyaki.reclaim(tokenId, newOwner.address);
        return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "reclaim should fail");
    });

    it("should fail for expired token", async function() {
        this.timeout(0);

        const label = "churchill";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);

        const takoyaki = Takoyaki.connect(owner);
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);
        const newOwner = await provider.createSigner();

        await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
        await provider.mineBlocks(1);

        const tx = await takoyaki.reclaim(tokenId, newOwner.address);
        return assert.rejects(tx.wait(), { code: "CALL_EXCEPTION" }, "reclaim should fail for non-owner");

    });
});

describe("ownerOf", function() {
    it("happy path", async function() {
        const label = "beauty";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);
        const tokenOwner = await takoyakiContract.ownerOf(tokenId);
        assert.ok(tokenOwner === owner.address);
    });

    it("should fail for invalid token", function() {
        const label = "bahamas";
        const tokenId = ethers.utils.id(label);
        return assert.rejects(takoyakiContract.ownerOf(tokenId));
    });

    it("should fail if token has expired", async function() {
        this.timeout(0);

        const label = "beach";
        const owner = await provider.createSigner();
        const receipt = await Takoyaki.register(provider, owner, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        await fastForward(REGISTRATION_PERIOD + 1);
        await provider.mineBlocks(1);

        return assert.rejects( takoyakiContract.ownerOf(tokenId) );
    });
});

describe("balanceOf", function() {
    it("happy path", async function() {
        const owner = await provider.createSigner("2");
        await Takoyaki.register(provider, owner, "gold");
        await Takoyaki.register(provider, owner, "silver");

        const balance = await takoyakiContract.balanceOf(owner.address);
        assert.ok(balance.eq(2), "balanceOf should equal 2");
    });

    it("should fail for 0 address", function() {
        const promise = takoyakiContract.balanceOf(ethers.constants.AddressZero);
         return assert.rejects(promise, Error, "balanceOf should fail for 0 address");
    });

    it("should return 0 if owner does not exist", async function() {
        const owner = await provider.createSigner();
        const balance = await takoyakiContract.balanceOf(owner.address);
        assert.ok(balance.eq(0), "balance should equal 0");
    });

    it("should decrement after transfer", async function() {
        const signer = await provider.createSigner("4");

        const takoyaki = Takoyaki.connect(signer);
        await Takoyaki.register(provider, signer, "golden");
        await Takoyaki.register(provider, signer, "gate");
        const receipt = await Takoyaki.register(provider, signer, "bridge");
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

        const newOwner = await provider.createSigner();
        await Takoyaki.safeTransfer(signer, signer, newOwner, tokenId);

        let balance = await takoyakiContract.balanceOf(signer.address);
        assert.ok(balance.eq(2), "balanceOf should equal 2");

        balance = await takoyakiContract.balanceOf(newOwner.address);
        assert.ok(balance.eq(1), "balanceOf should equal 1");
    });

    it("should decrement after destroy", async function() {
        this.timeout(0);

        const signer = await provider.createSigner("4");

        const takoyaki = Takoyaki.connect(signer);
        await Takoyaki.register(provider, signer, "lucky");
        const receipt = await Takoyaki.register(provider, signer, "star");
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

        // fast forward to past grace period
        await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
        await provider.mineBlocks(1);

        const tx = await takoyaki.destroy(tokenId);
        await tx.wait();

        const balance = await takoyakiContract.balanceOf(signer.address);
        assert.ok(balance.eq(1), "balanceOf should equal 1");

    });

    it("should remain the same after expiry if not destroyed", async function() {
        this.timeout(0);
        const signer = await provider.createSigner("2");

        const takoyaki = Takoyaki.connect(signer);
        await Takoyaki.register(provider, signer, "yummy");
        const receipt = await Takoyaki.register(provider, signer, "cookies");
        const tokenId = Takoyaki.getTokenId(takoyaki, receipt);

        // fast forward to past grace period
        await fastForward(REGISTRATION_PERIOD + GRACE_PERIOD + 1);
        await provider.mineBlocks(1);

        const balance = await takoyakiContract.balanceOf(signer.address);
        assert.ok(balance.eq(2), "balanceOf should equal 2");
    });
});

describe("setApprovalForAll", function() {
    it("isApprovedForAll should give approval value", async function() {
        const signer = await provider.createSigner();
        const operator = await provider.createSigner();
        const takoyaki = Takoyaki.connect(signer);

        let tx = await takoyaki.setApprovalForAll(operator.address, true);
        await tx.wait();

        let approved = await takoyaki.isApprovedForAll(signer.address, operator.address);
        assert.ok(approved === true, "approved should be true");

        tx = await takoyaki.setApprovalForAll(operator.address, false);
        await tx.wait();

        approved = await takoyaki.isApprovedForAll(signer.address, operator.address);
        assert.ok(approved === false, "approved should be false");
    });

    it("should allow non-owner or non-approved signer to transfer token if set true", async function() {
        const signer = await provider.createSigner();
        const operator = await provider.createSigner();
        const newOwner = await provider.createSigner();
        const takoyaki = Takoyaki.connect(signer);

        const tx = await takoyaki.setApprovalForAll(operator.address, true);
        await tx.wait();

        const label = "meetup";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        await Takoyaki.safeTransfer(operator, signer, newOwner, tokenId);
        const tokenOwner = await takoyakiContract.ownerOf(tokenId);
        assert.strictEqual(tokenOwner, newOwner.address, "newOwner should own token");
    });

    it("should not allow non-owner or non-approved to transfer token if set false", async function() {
        const signer = await provider.createSigner();
        const operator = await provider.createSigner();
        const newOwner = await provider.createSigner();
        const takoyaki = Takoyaki.connect(signer);

        const tx = await takoyaki.setApprovalForAll(operator.address, false);
        await tx.wait();

        const label = "osaka";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        return assert.rejects(Takoyaki.safeTransfer(operator, signer, newOwner, tokenId),
            { code: "CALL_EXCEPTION" }, "should not allow transfer by non-owner");
    });

    it("should allow non-owner or non-approved signer to set approval", async function() {
        const signer = await provider.createSigner();
        const operator = await provider.createSigner();
        let takoyaki = Takoyaki.connect(signer);

        const tx = await takoyaki.setApprovalForAll(operator.address, true);
        await tx.wait();

        const label = "canada";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        takoyaki = Takoyaki.connect(operator);
        const authorized = await provider.createSigner();
        const approveTx = await takoyaki.approve(authorized.address, tokenId);
        await approveTx.wait();

        const approved = await takoyaki.getApproved(tokenId);
        assert.strictEqual(approved, authorized.address, "should match approvee address");
    });

    it("should not allow non-owner to set approval if approved for all is false", async function() {
        const signer = await provider.createSigner();
        const operator = await provider.createSigner();
        let takoyaki = Takoyaki.connect(signer);

        const tx = await takoyaki.setApprovalForAll(operator.address, false);
        await tx.wait();

        const label = "ontario";
        const receipt = await Takoyaki.register(provider, signer, label);
        const tokenId = Takoyaki.getTokenId(takoyakiContract, receipt);

        takoyaki = Takoyaki.connect(operator);
        const authorized = await provider.createSigner();
        const approveTx = await takoyaki.approve(authorized.address, tokenId);
        return assert.rejects(approveTx.wait(), { code: "CALL_EXCEPTION" }, "approve should fail");
    });
});

describe("Name Validatation", function() {
    describe("Valid Names", function() {
        [ "lo", "r", "loo", "ricmoo", "ricmoo01234567890123",
          "0yfoobar", "1xfoobar", "1Xfoobar",
          "12345", "hello"
        ].forEach((name) => {
            it(name, function() {
                let contract = new ethers.Contract("takoyaki.eth", ABI, provider);
                contract.isValidLabel(name).then((isValid) => {
                    assert.ok(isValid, name);
                });
            });
        });
    });

    describe("Invalid Names", function() {
        [ "ricmoo012345678901234",
          "0xfoobar", "0Xfoobar"
        ].forEach((name) => {
            it(name, function() {
                let contract = new ethers.Contract("takoyaki.eth", ABI, provider);
                contract.isValidLabel(name).then((isValid) => {
                    assert.ok(!isValid, name);
                });
            });
        });
    });

    describe("Punycode Conversion", function() {
        [
            "\u53ef\u7231\u7684\u516b\u722a\u9c7c",
            "\u305f\u3053\u713c\u304d"
        ].forEach((name) => {
            it(name, function() {
                takoyakiContract.isValidLabel(name).then((isValid) => {
                    assert.ok(isValid, name);
                });
            });
        });
    })
});

