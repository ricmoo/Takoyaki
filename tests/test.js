"use strict";

const assert = require("assert");
const fs = require("fs");
const { resolve } = require("path");

const ethers = require("ethers");
const { compile } = require("@ethersproject/cli/solc");

const Takoyaki = require("../lib");

const ens = require("./ens");
const { SourceMapper } = require("./source-mapper");

// Start Parity in dev mode:
//   /home/ricmoo> echo "\n" > test.pwds
//   /home/ricmoo> parity --config dev-insecure --unlock=0x00a329c0648769a73afac7f9381e08fb43dbea72 --password test.pwds -d ./test

let provider = null;
let admin = null;
let ABI = null;

before(async function() {
    // Compile Takoyaki Registrar
    console.log("Compiling TakoyakiRegistrar...");
    let source = fs.readFileSync(resolve(__dirname, "../contracts/TakoyakiRegistrar.sol")).toString();

    let sourceMapper = new SourceMapper(source);
    sourceMapper.set("MIN_COMMIT_BLOCKS", null);
    sourceMapper.set("MAX_COMMIT_BLOCKS", "10");
    sourceMapper.set("WAIT_CANCEL_BLOCKS", "16");
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
        code = compile(sourceMapper.source, {
            optimize: true
        }).filter((contract) => (contract.name === "TakoyakiRegistrar"))[0];
    } catch (e) {
        e.errors.forEach((error) => {
            console.log(error);
        });
        throw new Error("Failed to compile TakoyakiRegistrar.sol");
    }
    ABI = code.interface;

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
        it("allows admin to withdraw", function() {
        });

        it("prevents non-admin from  withdrawing", function() {
        });
    });

});

describe("Name Registration (happy path)", function() {
    it("can register test.takoyaki.eth (no dust wallet)", async function() {
        let signer = await provider.createSigner();
        let takoyaki = Takoyaki.connect(signer);
        let salt = ethers.utils.keccak256(ethers.utils.randomBytes(32));

        let tx = await takoyaki.commit("test", signer.address, salt, ethers.constants.AddressZero, 0);
        let receipt = await tx.wait();
        // @TODO: check logs in receipt

        await provider.mineBlocks(5);

        tx = await takoyaki.reveal("test", signer.address, salt);
        receipt = await tx.wait();
        // @TODO: check logs in receipt

        let owner = await provider.resolveName("test.takoyaki.eth");
        assert.equal(owner, signer.address, "test.takoyaki.eth owner is not buyer");
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
});

describe("ERC-721 Operations", function() {
    // @TODO: Transfer, etc...
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
    })
});

