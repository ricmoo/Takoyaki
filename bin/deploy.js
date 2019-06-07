"use strict";

// Run using @ethersproject/cli

// Ropsten:
//   /home/ricmoo> ethers --account wallet.json --network ropsten run scripts/deploy.js

// Homestead:
//   /home/ricmoo> ethers --account wallet.json run scripts/deploy.js

const fs = require("fs");

const { compile } = require("@ethersproject/cli/solc");
const { ethers } = require("ethers");

(async function() {
    let code = compile(fs.readFileSync("./contracts/TakoyakiRegistrar.sol").toString(), {
        optimize: true
    }).filter((c) => (c.name === "TakoyakiRegistrar"))[0];
    console.log(code);

    let factory = new ContractFactory(code.interface, code.bytecode, accounts[0]);

    let network = await provider.getNetwork();
    console.log(network);

    let contract = await factory.deploy(network.ensAddress, namehash("takoyaki.eth"), {
       gasLimit: 3000000
    })
    console.log(contract);

    let receipt = contract.deployed();
    console.log(receipt);
})();
