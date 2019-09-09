import { BigNumber, Contract, ContractInterface, providers, Signer } from "ethers";
export declare type State = "available" | "grace" | "owned";
export declare type Genes = {
    salt: string;
    seeds: Array<string>;
    generation?: number;
    tokenId?: string;
    commitBlock?: number;
    revealBlock?: number;
    name?: string;
    expires?: number;
    status?: State;
    owner?: string;
    upkeepFee?: BigNumber;
};
export declare type Traits = {
    genes: Genes;
    state: number;
    eyes: number;
    mouth: number;
    mouth_r: number;
    mouth_s: number;
    tattoo: number;
    tattoo_d: number;
    tattoo_a: number;
    tattoo_r: number;
    tattoo_c: string;
    color1: number;
    color2: number;
    body_c: string;
    tentacle1_outside_c: string;
    tentacle2_outside_c: string;
    tentacle3_outside_c: string;
    tentacle4_outside_c: string;
    tentacle1_inside_c: string;
    tentacle2_inside_c: string;
    tentacle3_inside_c: string;
    tentacle4_inside_c: string;
    tentacle1_r: number;
    tentacle2_r: number;
    tentacle3_r: number;
    tentacle4_r: number;
};
export declare function getLabelColor(label: string, sat?: number, lum?: number): string;
export declare function getTraits(genes: Genes): Traits;
export declare function getSvg(traits: Traits, backgroundColor?: string): string;
export declare function submitReveal(signedTx: string, local?: boolean): Promise<string>;
export declare function getTakoyakiUrl(tokenIdOrLabel: string): string;
export declare type Hints = {
    blockNumber?: number;
    name?: string;
    salt?: string;
    commitBlock?: number;
    revealBlock?: number;
};
declare class TakoyakiContract extends Contract {
    readonly decimals = 0;
    readonly name = "Takoyaki";
    readonly symbol = "TAKO";
    _blockSeedCache: {
        [blockTag: string]: Promise<string>;
    };
    constructor(addressOrName: string, contractInterface: ContractInterface, signerOrProvider: Signer | providers.Provider);
    _getBlockSeed(blockNumber: number, currentBlockNumber?: number): Promise<string>;
    getTraits(tokenId: string, hints?: Hints): Promise<Traits>;
    getTransactions(label: string, owner: string, salt: string, prefundRevealer: string): Promise<{
        commit: string;
        reveal: string;
    }>;
    tokenURI(tokenId: string): string;
}
export declare function urlToLabel(url: string): string;
export declare function labelToUrl(label: string, local?: boolean): string;
export declare function normalizeLabel(label: string): string;
export declare function connect(signerOrProvider: Signer | providers.Provider): TakoyakiContract;
export {};
