"use strict";

const fs = require("fs");
const { resolve } = require("path");

const zlib = require("browserify-zlib");

let SVG = fs.readFileSync(resolve(__dirname, "../assets/takoyaki.svg")).toString();
//let zipped = zlib.gzipSync(SVG).toString("base64");

fs.writeFileSync(resolve(__dirname, "../asset.js"), `const svg = ${ JSON.stringify(SVG) }; module.exports = svg;`);

//console.log(`Compressed takoyaki.svg to asset.js (${ SVG.length } bytes => ${ zipped.length } bytes)`);
