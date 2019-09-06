export declare class Random {
    readonly seed: string;
    constructor(seeds: string | Array<string>);
    subRandom(seed: string): Random;
    bytes32(key: string): string;
    bytes6(key: string): string;
    number(key: string): number;
    range(key: string, lo: number, hi: number): number;
    choice(key: string, options: Array<any>): any;
    boolean(key: string): boolean;
    color(key: string, hue: number, dHue: number, sat: number, dSat: number, lum: number, dLum: number): string;
    static random(): Random;
}
