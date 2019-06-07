"use strict";

const fs = require("fs");

const { Contract } = require("@ethersproject/contracts");

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
    console.log(ordered);

    // Prune out old entries
    let now = getNow();
    ordered.slice(this._cacheSize).then((key) => {
        // Don't delete anything less than 10s old, we may still need it
        if (now - this._values.t < 10000) { return; }
        delete this._values[key];
    });
}

Cache.prototype.set = function(key, value) {
    this._values[key] = { v: value, t: getNow() }
}

Cache.prototype.get = function(key) {
    let value = this._values[key];
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
//   - 4 : Tattoo revealed (fully revealed)

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

function _getTraits(genes, hashCache) {
    let state = 4;
    if (!hashCache.get(genes.commitBlock + 1)) {
        state = 0;
    } else if (!hashCache.get(genes.commitBlock + 3)) {
       state = 1;
    } else if (!hashCache.get(genes.revealBlock + 1)) {
       state = 2;
    } else if (!hashCache.get(genes.revealBlock + 2)) {
       state = 3;
    }

    // For partially revealed Takoyaki, the image is hidden, so we can just
    // populate the hashes with anything (reuse the salt) so the math works
    let base = new Random([ genes.salt, (hashCache.get(genes.commitBlock + 1) || genes.salt) ]);
    let eyes = base.subRandom(hashCache.get(genes.commitBlock + 3) || genes.salt);
    let mouth = eyes.subRandom(hashCache.get(genes.revealBlock + 1) || genes.salt);
    let tattoo = mouth.subRandom(hashCache.get(genes.revealBlock + 2) || genes.salt);

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

        tattoo: tattoo.range("_", -1, Count.tattoo),            // Tattoo (or -1 for no tattoo)
        tattoo_d: tattoo.range("distance", 0, 60),             // Tattoo percent distance to shift
        tattoo_a: tattoo.range("angle", 0, 360),               // Tattoo Angle to shift
        tattoo_r: tattoo.range("rotate", 0, 30),               // Tattoo Rotation
        tattoo_c: tattoo.color("color", color1, 40, 50, 20, 20, 10),

        color1: color1,
        color2: color2,
        //spots: !!parseInt(Math.random() * 2),

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

function getTraits(provider, tokenId) {
    const address = "0x93285db68799256f562b446e0b420104f9e65721";
    const ABI = [
        "function getTakoyakiTraits(uint256 tokenId) external view returns (bytes32, uint48, uint48, uint48)",
        "event Registered(address indexed owner, uint256 indexed tokenId, string label, uint48 expires)"
    ];

    const contract = new Contract(address, ABI, provider);

    return Promise.all([
        provider.getBlockNumber(),
        contract.getTakoyakiTraits(tokenId)
    ]).then((results) => {
        let blockNumber = results[0];

        let genes = {
            generation: 0,

            tokenId: tokenId,

            salt: results[1][0],
            commitBlock: results[1][1],
            revealBlock: results[1][2],

            expires: results[1][3],

            name: null
        };

        let addBlock = (blockNumber) => {
            return provider.getBlock(blockNumber).then((block) => {
                HashCache.set(block.number, block.hash);
                HashCache.set(block.number - 1, block.parentHash);
            });
        };

        let filter = contract.filters.Registered(null, genes.tokenId);

        let promises = [
            contract.queryFilter(filter, genes.revealBlock, genes.revealBlock).then((events) => {
                events.forEach((event) => {
                    genes.name = event.values[2];
                });
            })
        ];

        if (!HashCache.get(genes.revealBlock + 1) || !(HashCache.get(genes.revealBlock + 2))) {
            promises.push(addBlock(genes.revealBlock + 2));
        }

        if (!HashCache.get(genes.commitBlock + 1)) {
            promises.push(addBlock(genes.commitBlock + 1));
        }

        if (!HashCache.get(genes.commitBlock + 3)) {
            promises.push(addBlock(genes.commitBlock + 3));
        }

        return Promise.all(promises).then(() => {
            return _getTraits(genes, HashCache);
        });
    });
}

function getBackgroundColor(label) {
    return _random.color(label, 0, 360, 90, 0, 90, 0);
}

let ethers = require("ethers");
getTraits(ethers.getDefaultProvider("ropsten"), ethers.utils.id("ricmoo")).then((traits) => {
    console.log(traits);
});

const _emptyCache = new Cache(1 << 1);

function randomTraits() {
    let traits = _getTraits({
        commitBlock: 0,
        revealBlock: 0,
        salt: Random.random().bytes32("base")
    }, _emptyCache);
    traits.state = 5;
    return traits;
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
    document.getElementById("body-2-c1").attributes.style = `fill: ${ traits.body_c }`;

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

module.exports = {
    SVG,

    getBackgroundColor,

    getTraits,
    randomTraits,

    getSvg,

}

