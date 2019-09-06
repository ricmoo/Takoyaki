"use strict";

import  { utils } from "ethers";

const hex = "0123456789abcdef";

export class Random {
    readonly seed: string;

    constructor(seeds: string | Array<string>) {
        let seed: string = null;
        if (Array.isArray(seeds)) {
            seed = ("0x" + seeds.map((s) => s.substring(2)).join(""));
        } else {
            seed = seeds;
        }
        utils.defineReadOnly(this, "seed", utils.keccak256(seed));
    }

    subRandom(seed: string): Random {
        return new Random([ this.seed, seed ]);
    }

    // Random 32 bytes
    bytes32(key: string): string {
        return utils.keccak256(this.seed + utils.id(key).substring(2));
    }

    bytes6(key: string): string {
        return utils.keccak256(this.seed + utils.id(key).substring(2)).substring(0, 14);
    }

    // Random number between 0 (inclusive) and 1 (exclusive)
    number(key: string): number {
        let value = parseInt(this.bytes32(key).substring(2, 14), 16);
        return value / 0x1000000000000;
    }

    // Return a random value in the range [ lo, hi - 1 ]
    range(key: string, lo: number, hi: number): number {
        return lo + parseInt(String(this.number(key) * (hi - lo)))
    }

    // Random choice from the Array options
    choice(key: string, options: Array<any>): any {
        return options[this.range(key, 0, options.length)];
    }

    // Random boolean value
    boolean(key: string): boolean {
        return this.choice(key, [ false, true ]);
    }

    // Returns a random color for seed with ((hue +/- (dHue/2)), (sat + dSat?), (lum + dLum?))
    color(key: string, hue: number, dHue: number, sat: number, dSat: number, lum: number, dLum: number): string {
        hue = (720 + hue - (dHue / 2) + this.number(key + "-hue") * dHue) % 360;
        sat += this.number(key + "-sat") * dSat;
        lum += this.number(key + "-lum") * dLum;
        return "hsl(" + parseInt(String(hue)) + ", " + parseInt(String(sat)) + "%, " + parseInt(String(lum)) + "%)";
    }

    static random(): Random {
        let seed = "0x";
        while (seed.length < 66) {
            seed += hex[parseInt(String(Math.random() * 16))];
        }
        return new Random(seed);
    }
}
