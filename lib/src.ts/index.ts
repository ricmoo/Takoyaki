"use strict";

import { toASCII, toUnicode } from "punycode";

import aes from "aes-js";
import { BigNumber, constants, Contract, ContractInterface, providers, Signer, utils } from "ethers";

import { svg as SVG } from "./asset";
import { Random } from "./random";
import { parse, SvgDocument, SvgNode } from "./svg-parser";

const Takoyaki = parse(SVG);
const _random = new Random("0x");

// States
//   - 0 : Nothing revealed
//   - 1 : Color1 revealed
//   - 2 : Eyes revealed
//   - 3 : Mouth reveals + Color2
//   - 4 : Tattoo revealed (with a tiny piece of a shell)
//   - 5 : Fully revealed

// Generate the traits object
// - seed    = commitSalt + (commitBlockhash + 1)
// - color1 := seed
// - eyes   := color1 + (commitBlockhash + 3)
// - mouth  := eyes   + (revealBlockhash + 1)
// - color2 := eyes   + (revealBlockhash + 1)
// - tattoo := mouth  + (revealBlockhash + 2)

const Count = {
    eyes: 20,
    mouth: 20,
    tattoo: 114
}

export type State = "available" | "grace" | "owned";

export type Genes = {
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

export type Traits = {
    genes: Genes;

    state: number;

    eyes: number;

    // Mouth with rotation and scale
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

    // The body color
    body_c: string;

    // The outside colors of the tentacles
    tentacle1_outside_c: string;
    tentacle2_outside_c: string;
    tentacle3_outside_c: string;
    tentacle4_outside_c: string;

    // The inside colors of the middle tentacles (outside tentacles not used yet)
    tentacle1_inside_c: string;
    tentacle2_inside_c: string;
    tentacle3_inside_c: string;
    tentacle4_inside_c: string;

    // The rotation of the tentacles
    tentacle1_r: number;
    tentacle2_r: number;
    tentacle3_r: number;
    tentacle4_r: number;
};

function _getTraits(genes: Genes): Traits {
    let state = 5;
    //if (!genes.commitBlock || !genes.seeds[0]) {
    if (!genes.seeds[0]) {
        state = 0;
    } else if (!genes.seeds[1]) {
       state = 1;
   // } else if (!genes.revealBlock || !genes.seeds[2]) {
    } else if (!genes.seeds[2]) {
       state = 2;
    } else if (!genes.seeds[3]) {
       state = 3;
    } else if (!genes.seeds[4]) {
       state = 4;
    }

    // For partially revealed Takoyaki, the image is hidden, so we can just
    // populate the hashes with anything (reuse the salt) so the math works
    let base = new Random([ genes.salt, (genes.seeds[0] || genes.salt) ]);
    let eyes = base.subRandom(genes.seeds[1] || genes.salt);
    let mouth = eyes.subRandom(genes.seeds[2] || genes.salt);
    let tattoo = mouth.subRandom(genes.seeds[3] || genes.salt);

    let color1 = base.range("color", 0, 360);
    let color2 = mouth.range("color", 0, 360);

    return {
        genes: genes,

        state: state,

        eyes: eyes.range("_", 0, Count.eyes),

        // Mouth with rotation and scale
        mouth: mouth.range("_", 0, Count.mouth),
        mouth_r: mouth.range("rotate", -8, 9),
        mouth_s: mouth.choice("flip", [ 1, -1 ]) * (mouth.range("scale", 100, 185) / 100),

        tattoo: tattoo.range("_", -1, Count.tattoo),                  // Tattoo (or -1 for no tattoo)
        tattoo_d: tattoo.range("distance", 0, 50),                    // Tattoo percent distance to shift
        tattoo_a: tattoo.range("angle", 0, 360),                      // Tattoo Angle to shift
        tattoo_r: tattoo.range("rotate", 0, 30),                      // Tattoo Rotation
        tattoo_c: tattoo.color("color", color1, 40, 50, 20, 20, 10),

        color1: color1,
        color2: color2,

        // The body color
        body_c: base.color("body", color1, 40, 50, 20, 60, 10),

        // The outside colors of the tentacles
        tentacle1_outside_c: base.color("outside1", color1, 40, 55, 25, 65, 20),
        tentacle2_outside_c: base.color("outside2", color1, 40, 55, 25, 65, 20),
        tentacle3_outside_c: base.color("outside3", color1, 40, 55, 25, 65, 20),
        tentacle4_outside_c: base.color("outside4", color1, 40, 55, 25, 65, 20),

        // The inside colors of the middle tentacles (outside tentacles not used yet)
        tentacle1_inside_c: mouth.color("inside1", color2, 20, 70, 20, 40, 20),
        tentacle2_inside_c: mouth.color("inside2", color2, 20, 70, 20, 40, 20),
        tentacle3_inside_c: mouth.color("inside3", color2, 20, 70, 20, 40, 20),
        tentacle4_inside_c: mouth.color("inside4", color2, 20, 70, 20, 40, 20),

        // The rotation of the tentacles
        tentacle1_r: base.range("rotate1", -15, 26),       // Tentacle1 angle
        tentacle2_r: base.range("rotate2", -25, 26),       // Tentacle2 angle
        tentacle3_r: base.range("rotate3", -25, 26),       // Tentacle3 angle
        tentacle4_r: base.range("rotate4", -20, 10),       // Tentacle4 angle
    };
}

export function getLabelColor(label: string, sat?: number, lum?: number): string {
    if (sat == null) { sat = 90; }
    if (lum == null) { lum = 90; }
    return _random.color(label, 0, 360, sat, 0, lum, 0);
}

export function getTraits(genes: Genes): Traits {
    if (!genes) {
        let rand = Random.random();
        genes = {
            salt: rand.bytes32("salt"),
            seeds: [
                rand.bytes6("0"),
                rand.bytes6("1"),
                rand.bytes6("2"),
                rand.bytes6("3"),
                rand.bytes6("4"),
            ]
        };
    }

    return _getTraits(genes);
}

function createList(prefix: string, count: number): Array<string> {
    let result = [ ];
    for (let i = 1; i <= count; i++) {
        result.push(prefix + i);
    }
    return result;
}

function show(document: SvgDocument, ids: Array<string>, keepIndex: number): SvgNode {
    if (keepIndex == null) { keepIndex = -1; }

    let result = null;
    ids.forEach((id, index) => {
        try {
            let el = document.getElementById(id);
            if (index === keepIndex) {
                result = el;
            } else {
                el.remove();
            }
        } catch (error) {
            console.log(id);
            throw error;
        }
    });

    return result;
}

function setFill(node: SvgNode, fill: string): void {
    (node.children || []).forEach((child) => {
        if (SvgNode.isNode(child)) {
            child.attributes.style = `fill: ${ fill }`;
            setFill(child, fill);
        }
    });
}

export function getSvg(traits: Traits, backgroundColor?: string): string {
    let document = Takoyaki.clone();

    // Show only the valid part of the shell (possibly none)
    show(document, createList("takoyaki-", 5), 4 - traits.state);

    // Show the Tako shadow only when it is fully revealed
    show(document, [ "shadow-tako" ], (traits.state >= 5) ? 0: -1);

    // Fix the clipping path (Adobe Illustrator and SVG don't seem
    // to agree on how to do this);
    let clipping = document.getElementById("body-2-clip_1_");
    (<SvgNode>(clipping.children[0])).attributes["xlink:href"] = "#body-2-clip";

    // Eyes
    show(document, createList("eyes-", Count.eyes), traits.eyes);

    // Mouth
    let mouth = show(document, createList("mouth-", Count.mouth), traits.mouth);
    if (mouth) {

        // The pivot point of the mouth
        let mouthBox = document.getElementById("mouth-box");

        let transformOrigin = (
            parseInt(mouthBox.attributes["cx"]) + "px " +
            parseInt(mouthBox.attributes["cy"]) + "px"
        );

        let scale = ("scale(" + traits.mouth_s + ", " + Math.abs(traits.mouth_s) + ")")
        let rotate = ("rotate(" + traits.mouth_r + "deg)")
        let transform = scale + " " + rotate;

        // Scale and rotate the mouth a little bit
        let style = `transform-origin: ${ transformOrigin }; transform: ${ transform }`;
        mouth.attributes.style = style;
    }

    // Tattoo
    let tattoo = show(document, createList("tattoo-", Count.tattoo), traits.tattoo);
    if (tattoo) {
        // The center pivot to rotate and translate the tattoo from
        let tattooBox = document.getElementById("tattoo-box");

        let transformOrigin = (
            parseInt(tattooBox.attributes["cx"]) + "px " +
            parseInt(tattooBox.attributes["cy"]) + "px"
        );

        let dist = parseInt(tattooBox.attributes["r"]) * traits.tattoo_d / 100;
        let dx = dist * Math.cos(traits.tattoo_a);
        let dy = dist * Math.sin(traits.tattoo_a);

        let translate = ("translate(" + parseInt(String(dx)) + "px, " + parseInt(String(dy)) + "px)");
        let rotate = ("rotate(" + (traits.tattoo_r - 15) + "deg)");
        let transform = translate + " " + rotate;

        let style = `transform-origin: ${ transformOrigin }; transform: ${ transform }; fill: ${ traits.tattoo_c }`;
        setFill(tattoo, traits.tattoo_c);

        tattoo.attributes.style = style;
    }

    // Set the body color
    document.getElementById("body").attributes.style = `fill: ${ traits.body_c }`;

    // Set the tentacle colors and rotation
    createList("tentacle-", 4).forEach((id) => {
        document.getElementById(id + "-c1").attributes.style = `fill: ${ (<any>traits)[id.replace("-", "") + "_outside_c"] }`;

        // The pivot point for the tentacle
        let tentacleBox = document.getElementById(id + "-box");

        let transformOrigin = (
            parseInt(tentacleBox.attributes["cx"]) + "px " +
            parseInt(tentacleBox.attributes["cy"]) + "px"
        );

        let rotate = ("rotate(" + ((<any>traits)[id.replace("-", "") + "_r"]) + "deg)");

        // Rotate the tentacle a little bit
        let style = `transform-origin: ${ transformOrigin }; transform: ${ rotate }`;
        document.getElementById(id).attributes.style = style;
    });

    // The inner color of the two middle tentacles
    ["tentacle-2", "tentacle-3"].forEach((id) => {
        document.getElementById(id + "-c2").attributes.style = `fill: ${ (<any>traits)[id.replace("-", "") + "_inside_c"] }`;
    });

    // Optionally set a background color (otherwise transparent)
    if (backgroundColor) {
        let style = document.svg.attributes.style || "";
         style += `; background-color: ${ backgroundColor }`;
         document.svg.attributes.style = style;
    }

    return document.render();
}

const RevealPublicKey = "0x02a9722b874612e4ef7282918bf05d55d6b2874eb2161ae5cebfb1b57058a89040";
export function submitReveal(signedTx: string, local?: boolean): Promise<string> {
    const ephemeralKey = new utils.SigningKey(utils.randomBytes(32));
    const key = utils.keccak256(ephemeralKey.computeSharedSecret(RevealPublicKey));
    const crypter = new aes.ModeOfOperation.ctr(utils.arrayify(key));
    const reveal = utils.hexlify(utils.concat([
        "0x01",
        ephemeralKey.compressedPublicKey,
        crypter.encrypt(utils.arrayify(utils.RLP.encode([
            signedTx
        ])))
    ]));

    let url = "https://takoyaki.cafe/reveal/";
    if (local) { url = "http://takoyaki.local:5000/reveal/"; }

    return utils.fetchJson(url + reveal.substring(2) + "/").then((result) => {
        if (result.hash !== utils.keccak256(reveal)) { throw new Error("hash mismatch"); }
        return reveal;
    });
}

function getDelta(date: number): string {
    function pad(v: number): string {
        let result = String(v);
        while(result.length < 2) { result = "0" + result; }
        return result;
    }

    let remaining = date - ((new Date()).getTime() / 1000);
    let display = [];
    let clump = 24 * 60 * 60
    if (remaining > clump) {
        let days = parseInt(String(remaining / clump))
        remaining -= days * clump;
        display.push(String(days) + "d");
    }
    clump = 60 * 60;
    if (remaining > clump || display.length) {
        let hours = parseInt(String(remaining / clump))
        remaining -= hours * clump;
        display.push(pad(hours) + "h");
    }
    clump = 60;
    if (remaining > clump || display.length) {
        let mins = parseInt(String(remaining / clump))
        remaining -= mins * clump;
        display.push(pad(mins) + "m");
    }
    display.push(pad(parseInt(String(remaining))) + "s");
    return display.join(":");
}

export function getTakoyakiUrl(tokenIdOrLabel: string): string {
    if (tokenIdOrLabel.substring(0, 2) === "0x") {
        return "https://takoyaki.cafe/json/" + tokenIdOrLabel.substring(2);
    }
    return getTakoyakiUrl(utils.id(tokenIdOrLabel));
}


const ABI = [
    "function admin() external view returns (address)",
    "function approve(address to, uint256 tokenId) external @150000",
    "function balanceOf(address owner) external view returns (uint256)",
    "function getBlindedCommit(bytes32 blindedCommit) public view returns (uint48 blockNumber, address payer, uint256 feePaid)",
    "function getTakoyaki(uint256 tokenId) view returns (bytes32 salt, address owner, uint upkeepFee, uint48 commitBlock, uint48 revealBlock, uint48 expires, uint8 status)",
    "function makeBlindedCommitment(string memory label, address owner, bytes32 salt) view returns (bytes32)",
    "function cancelCommitment(bytes32 blindedCommit) external @500000",
    "function commit(bytes32 blindedCommit, address prefundRevealer, uint prefundAmount) payable @150000",
    "function destroy(uint256 tokenId) external @275000",
    "function getApproved(uint256 tokenId) external view returns (address)",
    "function reveal(string label, address owner, bytes32 salt) @275000",
    "function reclaim(uint256 tokenId, address owner) external @150000",
    "function fee(string label) view returns (uint)",
    "function isValidLabel(string label) pure returns (bool)",
    "function renew(uint256 tokenId) external payable @500000",
    "function ownerOf(uint256 tokenId) public view returns (address)",
    "function safeTransferFrom(address from, address to, uint256 tokenId) public @500000",
//    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public @500000",
    "function setAdmin(address newAdmin) external @275000",
    "function setApprovalForAll(address to, bool approved) external",
    "function isApprovedForAll(address owner, address operator) public view returns (bool)",
    "function setFee(uint newFee) external @275000",
    "function setResolver(address newResolver) external @275000",
    "function syncUpkeepFee(uint256 tokenId) external @500000",
    "function tokenURI(uint256 _tokenId) external view returns (string memory)",
    "function withdraw(uint256 amount) @100000",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event Renewed(address indexed owner, uint256 indexed tokenId, uint48 expires)",
    "event Cancelled(address indexed funder, bytes32 commitment)",
    "event Committed(address indexed funder, bytes32 commitment)",
    "event Registered(address indexed owner, uint256 indexed tokenId, string label, uint48 expires)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// Maps a tokenId to its name (i.e. keccak256(id) => id)
// This cache is not ever flushed, but this should not be
// an issue unless Takoyaki becomes wildly popular and people
// query a lot of them.
const tokenIdCache: { [ tokenId: string ]: string } = { };

export type Hints = {
    blockNumber?: number;
    name?: string;
    salt?: string;
    commitBlock?: number;
    revealBlock?: number;
};

class TakoyakiContract extends Contract {
    readonly decimals = 0;
    readonly name = "Takoyaki";
    readonly symbol = "TAKO";

    _blockSeedCache: { [ blockTag: string ]: Promise<string> };

    constructor(addressOrName: string, contractInterface: ContractInterface, signerOrProvider: Signer | providers.Provider) {
        super(addressOrName, contractInterface, signerOrProvider);
        this._blockSeedCache = { };
    }

    async _getBlockSeed(blockNumber: number, currentBlockNumber?: number): Promise<string> {
        const blockTag = utils.hexValue(blockNumber);
        if (this._blockSeedCache[blockTag]) {
            return this._blockSeedCache[blockTag];
        }

        const blockPromise = this.provider.getBlock(blockTag);

        // Only cache block hashes that are stable to prevent caching across re-orgs
        if (currentBlockNumber && currentBlockNumber > blockNumber + 6) {
            this._blockSeedCache[blockTag] = blockPromise.then((block) => {
                return block.hash.substring(0, 14);
            });
            this._blockSeedCache[utils.hexValue(blockNumber - 1)] = blockPromise.then((block) => {
                return block.parentHash.substring(0, 14);
            });
        }

        const block = await blockPromise;

        return block.hash.substring(0, 14);
    }

    async getTraits(tokenId: string, hints?: Hints): Promise<Traits> {

        // The hints are used when the caller knows info not available yet. For
        // example, a buyer knows the name and may know the commit block before
        // the reveal, at which point the name and commit block become public.
        if (!hints) { hints = { }; }

        const { blockNumber, traits } = await utils.resolveProperties({
            blockNumber: Promise.resolve(hints.blockNumber || this.provider.getBlockNumber()),
            traits: this.functions.getTakoyaki(tokenId)
        });

        let genes: Genes = {
            generation: 0,

            tokenId: tokenId,

            salt: (hints.salt || traits.salt),
            commitBlock: (hints.commitBlock || traits.commitBlock),
            revealBlock: traits.revealBlock,
            seeds: [ ],

            name: (hints.name || tokenIdCache[tokenId] || null),

            expires: traits.expires,
            status: (<State>(["available", "grace", "owned"][traits.status])),
            owner: traits.owner,
            upkeepFee: traits.upkeepFee,
        };

        // Unowned; no need to load blocks
        if (genes.commitBlock === 0) { return _getTraits(genes); }

        let promises: { [ key: string ]: Promise<any> } = { };

        if (!genes.name && genes.revealBlock) {
            let filter = this.filters.Registered(null, genes.tokenId);
            promises.name = this.queryFilter(filter, genes.revealBlock, genes.revealBlock).then((events) => {
                let result = null;
                events.forEach((event) => {
                    const name = event.values[2];
                    if (utils.id(name) !== genes.tokenId) {
                        console.log("WHAT?!", genes, event);
                        return;
                    }
                    tokenIdCache[genes.tokenId] = name;
                    result = name;
                });
                return result;
            });
        }

        if (genes.commitBlock) {
            if (genes.commitBlock + 1 <= blockNumber) {
                promises.seed_c1 = this._getBlockSeed(genes.commitBlock + 1, blockNumber);
            }

            if (genes.commitBlock + 3 <= blockNumber) {
                promises.seed_c3 = this._getBlockSeed(genes.commitBlock + 3, blockNumber);
            }
        }

        if (genes.revealBlock) {
            if (genes.revealBlock + 1 <= blockNumber) {
                promises.seed_r1 = this._getBlockSeed(genes.revealBlock + 1, blockNumber);
            }

            if (genes.revealBlock + 3 <= blockNumber) {
                promises.seed_r3 = this._getBlockSeed(genes.revealBlock + 3, blockNumber);
            }

            if (genes.revealBlock + 5 <= blockNumber) {
                promises.seed_r5 = this._getBlockSeed(genes.revealBlock + 5, blockNumber);
            }
        }

        let values = await utils.resolveProperties(promises);

        if (values.name && !genes.name) {
            genes.name = values.name;
        }

        genes.seeds = [
            (values.seed_c1 || null),
            (values.seed_c3 || null),
            (values.seed_r1 || null),
            (values.seed_r3 || null),
            (values.seed_r5 || null),
        ];

        return _getTraits(genes);
    }

    async getTransactions(label: string, owner: string, salt: string, prefundRevealer: string): Promise<{ commit: string, reveal: string}> {
        const { gasPrice, prefundBalance, fee, info, blindedCommitment } = await utils.resolveProperties({
            gasPrice: this.provider.getGasPrice(),
            prefundBalance: (prefundRevealer ? this.provider.getBalance(prefundRevealer): Promise.resolve(0)),
            fee: this.functions.fee(label).catch((error) => { throw new Error('Invalid name')}),
            info: this.functions.getTakoyaki(utils.id(label)),
            blindedCommitment: this.functions.makeBlindedCommitment(label, owner, salt)
        });

        if (info.status !== 0) {
            throw new Error("Takoyaki is not available (expires in " + getDelta(info.expires) + ")");
        }

        let revealGasPrice = gasPrice.mul(2);
        let revealCost = revealGasPrice.mul(this.interface.functions.reveal.gas.add(21000));

        let topUp = 0;

        if (prefundRevealer) {
            if (prefundBalance.gte(revealCost)) {
                prefundRevealer = constants.AddressZero;
            } else {
                topUp = revealCost.sub(prefundBalance);
            }
        } else {
            prefundRevealer = constants.AddressZero;
        }

        return utils.resolveProperties({
            commit: this.populateTransaction.commit(blindedCommitment, prefundRevealer, topUp, {
                gasPrice: gasPrice,
                value: fee.add(topUp)
            }),
            reveal: this.populateTransaction.reveal(label, owner, salt, {
                gasPrice: revealGasPrice
            })
        });
    }

    tokenURI(tokenId: string): string {
        return getTakoyakiUrl(tokenId);
    }
}


export function urlToLabel(url: string): string {
    let comps = (url || "").split(".");
    if (comps.length !== 3 || comps[1] !== "takoyaki") { return null; }
    return toUnicode(comps[0]);
}

export function labelToUrl(label: string, local?: boolean): string {
    if (local) {
        return "http://" + toASCII(label.toLowerCase()) + ".takoyaki.local:8000/";
    }
    return "https://" + toASCII(label.toLowerCase()) + ".takoyaki.cafe";
}

export function normalizeLabel(label: string): string {
    return toUnicode(toASCII(label.toLowerCase()));
}

export function connect(signerOrProvider: Signer | providers.Provider): TakoyakiContract {
    return new TakoyakiContract("takoyaki.eth", ABI, signerOrProvider);
}


