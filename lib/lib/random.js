"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ethers_1 = require("ethers");
var hex = "0123456789abcdef";
var Random = /** @class */ (function () {
    function Random(seeds) {
        var seed = null;
        if (Array.isArray(seeds)) {
            seed = ("0x" + seeds.map(function (s) { return s.substring(2); }).join(""));
        }
        else {
            seed = seeds;
        }
        ethers_1.utils.defineReadOnly(this, "seed", ethers_1.utils.keccak256(seed));
    }
    Random.prototype.subRandom = function (seed) {
        return new Random([this.seed, seed]);
    };
    // Random 32 bytes
    Random.prototype.bytes32 = function (key) {
        return ethers_1.utils.keccak256(this.seed + ethers_1.utils.id(key).substring(2));
    };
    Random.prototype.bytes6 = function (key) {
        return ethers_1.utils.keccak256(this.seed + ethers_1.utils.id(key).substring(2)).substring(0, 14);
    };
    // Random number between 0 (inclusive) and 1 (exclusive)
    Random.prototype.number = function (key) {
        var value = parseInt(this.bytes32(key).substring(2, 14), 16);
        return value / 0x1000000000000;
    };
    // Return a random value in the range [ lo, hi - 1 ]
    Random.prototype.range = function (key, lo, hi) {
        return lo + parseInt(String(this.number(key) * (hi - lo)));
    };
    // Random choice from the Array options
    Random.prototype.choice = function (key, options) {
        return options[this.range(key, 0, options.length)];
    };
    // Random boolean value
    Random.prototype.boolean = function (key) {
        return this.choice(key, [false, true]);
    };
    // Returns a random color for seed with ((hue +/- (dHue/2)), (sat + dSat?), (lum + dLum?))
    Random.prototype.color = function (key, hue, dHue, sat, dSat, lum, dLum) {
        hue = (720 + hue - (dHue / 2) + this.number(key + "-hue") * dHue) % 360;
        sat += this.number(key + "-sat") * dSat;
        lum += this.number(key + "-lum") * dLum;
        return "hsl(" + parseInt(String(hue)) + ", " + parseInt(String(sat)) + "%, " + parseInt(String(lum)) + "%)";
    };
    Random.random = function () {
        var seed = "0x";
        while (seed.length < 66) {
            seed += hex[parseInt(String(Math.random() * 16))];
        }
        return new Random(seed);
    };
    return Random;
}());
exports.Random = Random;
