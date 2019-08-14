"use strict";

// Run using @ethersproject/cli

// Ropsten:
//   /home/ricmoo> ethers --account wallet.json --network ropsten run scripts/deploy.js

// Homestead:
//   /home/ricmoo> ethers --account wallet.json run scripts/deploy.js

const fs = require("fs");

const { compile } = require("@ethersproject/cli/solc");
const { ethers } = require("ethers");

function getAbi(fragment) {
    console.log(fragment);
    if (fragment.type === "event") {
        return {
            name: fragment.name,
            inputs: fragment.inputs.map((fragment) => getAbi(fragment)),
            type: "event"
        };

    } else if (fragment.type === "function") {
        return {
            constant: fragment.constant,
            mutabilityState: fragment.mutabilityState,
            name: fragment.name,
            inputs: fragment.inputs.map((fragment) => getAbi(fragment)),
            outputs: fragment.inputs.map((fragment) => getAbi(fragment)),
            type: "function"
        };

    } else if (fragment._isParamType) {
        let result = {
            type: fragment.type
        };
        if (typeof(fragment.indexed) === "boolean") {
            result.indexed = fragment.indexed;
        }
        return result;
    } else {
        console.log("Unahndled:" , fragment);
    }
}

(async function() {
    let code = compile(fs.readFileSync("./contracts/TakoyakiRegistrar.sol").toString(), {
        optimize: true
    }).filter((c) => (c.name === "TakoyakiRegistrar"))[0];
    //console.dir(code, { depth: null });
    //let abi = JSON.stringify(code.interface.fragments.map((fragment) => getAbi(fragment)).filter((abi) => (!!abi)));
    //console.log(abi, abi.length);
    /*
    let hrAbi = JSON.stringify(code.interface.fragments.map((fragment) => {
        fragment = Fragment.from(fragment.format(true));
        return fragment.format("minimal")
    }));
    console.log(hrAbi, hrAbi.length);
    */

    // Set the admin to be the controller of takoyaki.eth before calling this script


    let admin = accounts[0];
    let adminAddress = await admin.getAddress();
    let network = await provider.getNetwork();

    let factory = new ContractFactory(code.interface, code.bytecode, admin);

    let contract = await factory.deploy(network.ensAddress, namehash("takoyaki.eth"), "resolver.eth", {
       gasLimit: 3000000
    })
    console.log("Point the takoyaki.eth controller to:", contract.address);

    let receipt = await contract.deployed();
    console.log(receipt);

    let reverseNodehash = namehash(contract.address.substring(2) + ".addr.reverse");

    // Set the resolver of the reverse name record
    let ensAbi = [
        "function setResolver(bytes32 nodehash, address resolver) @250000",
        "function setOwner(bytes32 nodehash, address owner) @250000"
    ];

    let ensContract = new Contract(network.ensAddress, ensAbi, admin);
    let tx = await ensContract.setResolver(reverseNodehash, "resolver.eth");
    receipt = await tx.wait();
    console.log(receipt);

    // Set the name in the reverse name record resolver
    let resolverAbi = [
        "function setName(bytes32 nodehash, string name) @250000"
    ];

    let resolverContract = new Contract("resolver.eth", resolverAbi, admin);
    tx = await resolverContract.setName(reverseNodehash, "takoyaki.eth");
    receipt = await tx.wait();
    console.log(receipt);

    // TODO: Set the ABI for takoyaki.eth

    // @TODO: Set the contract as the controller of takoyaki.eth

})();
