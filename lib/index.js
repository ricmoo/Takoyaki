"use strict";

const inherits = require("inherits");

const { toASCII, toUnicode } = require("punycode");

const { constants, Contract, utils } = require("ethers");

const SVG = require("./asset");
const { Random } = require("./random");
const { parse } = require("./svg-parser");

const Takoyaki = parse(SVG);
const _random = new Random("0x");

function getNow() { return (new Date()).getTime(); }

function Cache(cacheSize) {
    this._cacheSize = cacheSize;
    this._values = { };
    let prunner = setInterval(() => { this.prune(); });
    if (prunner.unref) { prunner.unref(); }
}

Cache.prototype.prune = function() {
    let ordered = Object.keys(this._values);
    if (ordered.length < this._cacheSize) { return; }

    ordered.sort((a, b) => (a.t - b.t));

    // Prune out old entries
    let now = getNow();
    ordered.slice(this._cacheSize).then((key) => {
        // Don't delete anything less than 10s old, we may still need it
        if (now - this._values.t < 10000) { return; }
        delete this._values[key];
    });
}

Cache.prototype.set = function(key, value) {
    this._values[String(key)] = { v: value, t: getNow() }
}

Cache.prototype.get = function(key) {
    let value = this._values[String(key)];
    if (value == null) { return null; }
    value.t = getNow();
    return value.v;
}

// A 16k entry cache for blockNumber => blockHash
const HashCache = new Cache(1 << 14);

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

function _getTraits(genes) {
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

function getLabelColor(label, sat, lum) {
    if (sat == null) { sat = 90; }
    if (lum == null) { lum = 90; }
    return _random.color(label, 0, 360, sat, 0, lum, 0);
}

const _emptyCache = new Cache(1 << 5);

function getTraits(genes) {
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

function createList(prefix, count) {
    let result = [ ];
    for (let i = 1; i <= count; i++) {
        result.push(prefix + i);
    }
    return result;
}

function show(document, ids, keepIndex) {
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

function setFill(node, fill) {
    (node.children || []).forEach((child) => {
        child.attributes.style = `fill: ${ fill }`;
        setFill(child, fill);
    });
}

function getSvg(traits, backgroundColor) {
    let document = Takoyaki.clone();

    // Show only the valid part of the shell (possibly none)
    show(document, createList("takoyaki-", 5), 4 - traits.state);

    // Show the Tako shadow only when it is fully revealed
    show(document, [ "shadow-tako" ], (traits.state >= 5) ? 0: -1);

    // Fix the clipping path (Adobe Illustrator and SVG don't seem
    // to agree on how to do this);
    let clipping = document.getElementById("body-2-clip_1_");
    clipping.children[0].attributes["xlink:href"] = "#body-2-clip";

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

        let translate = ("translate(" + parseInt(dx) + "px, " + parseInt(dy) + "px)");
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
        document.getElementById(id + "-c1").attributes.style = `fill: ${ traits[id.replace("-", "") + "_outside_c"] }`;

        // The pivot point for the tentacle
        let tentacleBox = document.getElementById(id + "-box");

        let transformOrigin = (
            parseInt(tentacleBox.attributes["cx"]) + "px " +
            parseInt(tentacleBox.attributes["cy"]) + "px"
        );

        let rotate = ("rotate(" + (traits[id.replace("-", "") + "_r"]) + "deg)");

        // Rotate the tentacle a little bit
        let style = `transform-origin: ${ transformOrigin }; transform: ${ rotate }`;
        document.getElementById(id).attributes.style = style;
    });

    // The inner color of the two middle tentacles
    ["tentacle-2", "tentacle-3"].forEach((id) => {
        document.getElementById(id + "-c2").attributes.style = `fill: ${ traits[id.replace("-", "") + "_inside_c"] }`;
    });

    // Optionally set a background color (otherwise transparent)
    if (backgroundColor) {
        let style = document.svg.attributes.style || "";
         style += `; background-color: ${ backgroundColor }`;
         document.svg.attributes.style = style;
    }

    return document.render();
}

function getTakoyakiUrl(tokenIdOrLabel) {
    if (tokenIdOrLabel.substring(0, 2) === "0x") {
        return "https://takoyaki.cafe/json/" + tokenIdOrLabel.substring(2);
    }
    return getTakoyakiUrl(utils.id(tokenIdOrLabel));
}


const ABI = [
    "function getTakoyaki(uint256 tokenId) view returns (bytes32 salt, address owner, uint upkeepFee, uint48 commitBlock, uint48 revealBlock, uint48 expires, uint8 status)",
    "function makeBlindedCommitment(string memory label, address owner, bytes32 salt) view returns (bytes32)",
    "function commit(bytes32 blindedCommit, address prefundRevealer, uint prefundAmount) payable @150000",
    "function reveal(string label, address owner, bytes32 salt) @275000",
    "function fee(string label) view returns (uint)",
    "function isValidLabel(string label) pure returns (bool)",
    "event Registered(address indexed owner, uint256 indexed tokenId, string label, uint48 expires)"
];


function TakoyakiContract(address, ABI, signerOrProvider) {
    Contract.call(this, address, ABI, signerOrProvider);
}
inherits(TakoyakiContract, Contract);

const inflightBlocks = { };
TakoyakiContract.prototype.getTraits = function(tokenId, hints) {
    // The hints are used when the caller knows info not available yet. For
    // example, a buyer knows the name and may know the commit block before
    // the reveal, at which point the name and commit block become public.
    if (!hints) { hints = { }; }

    return Promise.all([
        Promise.resolve(hints.blockNumber || this.provider.getBlockNumber()),
        this.functions.getTakoyaki(tokenId)
    ]).then((results) => {
        let blockNumber = results[0];
        let traits = results[1];

        let genes = {
            generation: 0,

            tokenId: tokenId,

            salt: (hints.salt || traits.salt),
            commitBlock: (hints.commitBlock || traits.commitBlock),
            revealBlock: traits.revealBlock,
            seeds: [ ],

            name: (hints.name || null),

            expires: traits.expires,
            status: (["available", "grace", "owned"][traits.status]),
            owner: traits.owner,
            upkeepFee: traits.upkeepFee,
        };

        // Unowned; no need to load blocks
        if (genes.commitBlock === 0) { return _getTraits(genes); }

        let addBlock = (blockNumber) => {
            let key = String(blockNumber);

            if (!inflightBlocks[key]) {
                let promise = this.provider.getBlock(blockNumber).then((block) => {
                    HashCache.set(block.number, block.hash.substring(0, 14));
                    HashCache.set(block.number - 1, block.parentHash.substring(0, 14));
                    if (inflightBlocks[key] === promise) { delete inflightBlocks[key]; }
                }, (error) => {
                    delete inflightBlocks[key];
                });
                inflightBlocks[key] = promise

                setTimeout(() => {
                    if (inflightBlocks[key] === promise) { delete inflightBlocks[key]; }
                }, 4000);
            }

            return inflightBlocks[key];
        };

        let promises = [ ];

        if (!genes.name && genes.revealBlock) {
            let filter = this.filters.Registered(null, genes.tokenId);
            promises.push(this.queryFilter(filter, genes.revealBlock, genes.revealBlock).then((events) => {
                events.forEach((event) => {
                    genes.name = event.values[2];
                });
            }));
        }

        if (genes.revealBlock) {
            if (genes.revealBlock + 1 <= blockNumber && !HashCache.get(genes.revealBlock + 1)) {
                promises.push(addBlock(genes.revealBlock + 1));
            }

            if (genes.revealBlock + 3 <= blockNumber && !HashCache.get(genes.revealBlock + 3)) {
                promises.push(addBlock(genes.revealBlock + 3));
            }

            if (genes.revealBlock + 5 <= blockNumber && !HashCache.get(genes.revealBlock + 5)) {
                promises.push(addBlock(genes.revealBlock + 5));
            }
        }

        if (genes.commitBlock) {
            if (genes.commitBlock + 1 <= blockNumber && !HashCache.get(genes.commitBlock + 1)) {
                promises.push(addBlock(genes.commitBlock + 1));
            }

            if (genes.commitBlock + 3 <= blockNumber && !HashCache.get(genes.commitBlock + 3)) {
                promises.push(addBlock(genes.commitBlock + 3));
            }
        }

        return Promise.all(promises).then(() => {
            genes.seeds = [
                HashCache.get(genes.commitBlock + 1),
                HashCache.get(genes.commitBlock + 3),
                HashCache.get(genes.revealBlock + 1),
                HashCache.get(genes.revealBlock + 3),
                HashCache.get(genes.revealBlock + 5),
            ];

            return _getTraits(genes);
        });
    });
}
/*
TakoyakiContract.prototype.getTakoyaki = function(label) {
    return this.functions.getTakoyaki(utils.id(label)).then((info) => {
    });
}
*/
function getDelta(date) {
    function pad(v) {
        v = String(v);
        while(v.length < 2) { v = "0" + v; }
        return v;
    }

    let remaining = date - ((new Date()).getTime() / 1000);
    let display = [];
    let clump = 24 * 60 * 60
    if (remaining > clump) {
        let days = parseInt(remaining / clump)
        remaining -= days * clump;
        display.push(String(days) + "d");
    }
    clump = 60 * 60;
    if (remaining > clump || display.length) {
        let hours = parseInt(remaining / clump)
        remaining -= hours * clump;
        display.push(pad(hours) + "h");
    }
    clump = 60;
    if (remaining > clump || display.length) {
        let mins = parseInt(remaining / clump)
        remaining -= mins * clump;
        display.push(pad(mins) + "m");
    }
    display.push(pad(parseInt(remaining)) + "s");
    return display.join(":");
}

TakoyakiContract.prototype.getTransactions = function(label, owner, salt, prefundRevealer) {
    return Promise.all([
        this.provider.getGasPrice(),
        (prefundRevealer ? this.provider.getBalance(prefundRevealer): Promise.resolve(0)),
        this.functions.fee(label).catch((error) => { throw new Error('Invalid name (names must be 3 - 20 UTF-8 bytes long, and not begin with "0x")')}),
        this.functions.getTakoyaki(utils.id(label)),
        this.functions.makeBlindedCommitment(label, owner, salt)
    ]).then((results) => {
        let gasPrice = results[0];
        let prefundBalance = results[1];
        let fee = results[2];
        let info = results[3];
        let blindedCommitment = results[4];

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

        return Promise.all([
            this.populateTransaction.commit(blindedCommitment, prefundRevealer, topUp, {
                gasPrice: gasPrice,
                value: fee.add(topUp)
            }),
            this.populateTransaction.reveal(label, owner, salt, {
                gasPrice: revealGasPrice
            })
        ]).then((results) => {
            return {
                commit: results[0],
                reveal: results[1]
            };
        });
    });
}


TakoyakiContract.prototype.commit = function(label, owner, salt, prefundRevealer, prefundAmount) {
    if (prefundAmount == null) { prefundAmount = 0; }
    let overrides = {
       //gasLimit: 500000,
       value: this.fee(label).then((fee) => fee.add(prefundAmount))
    };
    return this.functions.makeBlindedCommitment(label, owner, salt).then((blindedCommit) => {
        return this.functions.commit(blindedCommit, prefundRevealer, prefundAmount, overrides);
    });
}

TakoyakiContract.prototype.reveal = function(label, owner, salt) {
    // @TODO: Use getBlindedCommit to make sure this is not too early
    return this.functions.reveal(label, owner, salt);
};

utils.defineReadOnly(TakoyakiContract.prototype, "decimals", 0);
utils.defineReadOnly(TakoyakiContract.prototype, "name", "Takoyaki");
utils.defineReadOnly(TakoyakiContract.prototype, "symbol", "TAKO");

TakoyakiContract.prototype.tokenURI = function(tokenId) {
    return getTakoyakiUrl(tokenId);
}

module.exports = {
    SVG,

    urlToLabel: function(url) {
        let comps = (url || "").split(".");
        if (comps.length !== 3 || comps[1] !== "takoyaki") { return null; }
        return toUnicode(comps[0]);
    },
    labelToUrl: function(label, local) {
        if (local) {
            return "http://" + toASCII(label.toLowerCase()) + ".takoyaki.local:8000/";
        }
        return "https://" + toASCII(label.toLowerCase()) + ".takoyaki.cafe";
    },

    normalizeLabel: function(label) {
        return toUnicode(toASCII(label.toLowerCase()));
    },

    connect: function(signerOrProvider) {
        return new TakoyakiContract("takoyaki.eth", ABI, signerOrProvider);
    },

    getLabelColor,
    getSvg,
    getTakoyakiUrl: getTakoyakiUrl,
    getTraits,
}
