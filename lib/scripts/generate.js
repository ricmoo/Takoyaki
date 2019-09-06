"use strict";

const fs = require("fs");
const { resolve } = require("path");

const { parse } = require("../lib/svg-parser");

let _SVG = fs.readFileSync(resolve(__dirname, "../assets/takoyaki.svg")).toString();
let SVG = parse(_SVG).render();

fs.writeFileSync(resolve(__dirname, "../src.ts/asset.ts"), `export const svg = ${ JSON.stringify(SVG) };`);
