"use strict";

const fs = require("fs");

const { compile } = require("@ethersproject/cli/solc");
const { ethers } = require("ethers");

(async function() {
    let code = compile(fs.readFileSync("./contracts/TakoyakiRegistrar.sol").toString(), {
        optimize: true
    }).filter((c) => (c.name === "TakoyakiRegistrar"))[0];
    console.log(code);
})();
