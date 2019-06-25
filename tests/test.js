"use strict";

const assert = require("assert");
const fs = require("fs");
const { resolve } = require("path");

const ethers = require("ethers");
const { compile } = require("@ethersproject/cli/solc");

const ens = require("./ens");

// Start Parity in dev mode:
//   /home/ricmoo> echo "\n" > test.pwds
//   /home/ricmoo> parity --config dev-insecure --unlock=0x00a329c0648769a73afac7f9381e08fb43dbea72 --password test.pwds -d ./test

let provider = null;
let admin = null;
let contractAddress = null;
let ABI = null;

before(async function() {
    // Deploy ENS
    console.log("Deploying ENS...");
    provider = await ens.prepareProvider("http://localhost:8545");
    provider.pollingInterval = 500;
    let ensAddress = await provider.getNetwork().then((network) => network.ensAddress);

    // Fund the admin account
    admin = ethers.Wallet.createRandom().connect(provider);
    let fundTx = await provider.getSigner().sendTransaction({
        to: admin.address,
        value: ethers.utils.parseEther("0.2")
    });
    await fundTx.wait();

    // Compile Takoyaki Registrar
    console.log("Compiling TakoyakiRegistrar...");
    let source = fs.readFileSync(resolve(__dirname, "../contracts/TakoyakiRegistrar.sol")).toString();
    let code = compile(source, {
        optimize: true
    }).filter((contract) => (contract.name === "TakoyakiRegistrar"))[0];
    ABI = code.interface;

    // @TODO: support this in ethers
    let defaultResolver = await provider.resolveName("resolver.eth");

    // Deploy Takoyaki Registrar
    console.log("Deploying TakoyakiRegistrar...");
    let contractFactory = new ethers.ContractFactory(ABI, code.bytecode, admin);
    let contract = await contractFactory.deploy(ensAddress, ethers.utils.namehash("takoyaki.eth"), defaultResolver, {
        gasLimit: 4300000
    });
    contractAddress = contract.address;
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
            let contract = new ethers.Contract(contractAddress, ABI, provider);
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
    describe("Register test.takoyaki.eth", function() {
    });
});

