"use strict";

const fs = require("fs");

const SVG = require("./asset");
const { parse } = require("./svg-parser");

const Takoyaki = parse(SVG);

function getTraits(provider, tokenId) {
}

function randomTraits() {
    return {
        generation: 0,
        seed: "0x123456789",

        eyes: parseInt(Math.random() * 12),

        mouth: parseInt(Math.random() * 11),
        mouth_r: parseInt(Math.random() * 16),             // Mouth rotation -8
        mouth_s: 1 + parseInt(Math.random() * 85) / 100,   // Mouth scale

        tattoo: parseInt(Math.random() * 56) - 1,           // Tattoo (or -1 for no tattoo)
        tattoo_d: parseInt(Math.random() * 60),            // Tattoo percent distance to shift
        tattoo_a: parseInt(Math.random() * 360),           // Tattoo Angle to shift
        tattoo_r: parseInt(Math.random() * 30),            // Tattoo Rotation

        color1: parseInt(Math.random() * 360),
        color2: parseInt(Math.random() * 360),
        spots: !!parseInt(Math.random() * 2)
    };
}

function createList(prefix, count) {
    let result = [ ];
    for (let i = 1; i <= count; i++) {
        result.push(prefix + i);
    }
    return result;
}

// Returns a random number given a string seed
function random(seed) {
    //let value = parseInt((seed).substring(2, 10), 16);
    //return value / 0xffffffff;
    return Math.random();
}

// Returns a random color for seed with ((hue +/- (dHue/2)), (sat + dSat?), (lum + dLum?))
function getRandomColor(seed, hue, dHue, sat, dSat, lum, dLum) {
    hue = (720 + hue - (dHue / 2) + random(seed + "-hue") * dHue) % 360;
    sat += random(seed + "-sat") * dSat;
    lum += random(seed + "-lum") * dLum;
    return "hsl(" + parseInt(hue) + ", " + parseInt(sat) + "%, " + parseInt(lum) + "%)";
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

function getSvg(state, traits, backgroundColor) {
    let document = Takoyaki.clone();
    show(document, createList("takoyaki-", 5), -1);

    // Fix the clipping path (Adobe Illustrator and AVG don't seem
    // to agree on how to do this);
    let clipping = document.getElementById("body-2-clip_1_");
    clipping.children[0].attributes["xlink:href"] = "#body-2-clip";

    show(document, createList("eyes-", 12), traits.eyes);

    let mouth = show(document, createList("mouth-", 11), traits.mouth);
    if (mouth) {
        let mouthBox = document.getElementById("mouth-box");
        let transformOrigin = (
            parseInt(mouthBox.attributes["cx"]) + "px " +
            parseInt(mouthBox.attributes["cy"]) + "px"
        );

        let scale = ("scale(" + traits.mouth_s + ")")
        let rotate = ("rotate(" + (traits.mouth_r - 8) + "deg)")
        let transform = scale + " " + rotate;

        let style = `transform-origin: ${ transformOrigin }; transform: ${ transform }`;
        mouth.attributes.style = style;
    }

    let tattoo = show(document, createList("tattoo-", 55), traits.tattoo);
    if (tattoo) {
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

        let fill = getRandomColor(traits.seed, traits.color1, 40, 50, 20, 20, 10);
        let style = `transform-origin: ${ transformOrigin }; transform: ${ transform }; fill: ${ fill }`;
        setFill(tattoo, fill);

        tattoo.attributes.style = style;
    }

    document.getElementById("body-2-c1").children[0].attributes.style =
        `fill: ${ getRandomColor(traits.seed, traits.color1, 40, 50, 20, 60, 10) }`;

    for (let i = 1; i < 5; i++) {
        document.getElementById("tenticle-" + String(i) + "-c1").children[0].attributes.style =
            `fill: ${ getRandomColor(traits.seed + "-outside" + String(i), traits.color1, 40, 55, 25, 65, 20) }`;
    }

    for (let i = 2; i < 4; i++) {
        document.getElementById("tenticle-" + String(i) + "-c2").children[0].attributes.style = 
            `fill: ${ getRandomColor(traits.seed + "-inside" + String(i), traits.color2, 20, 70, 20, 40, 20) }`;
    }

    if (backgroundColor) {
        let style = document.svg.attributes.style || "";
         style += `; background-color: ${ backgroundColor }`;
         document.svg.attributes.style = style;
    }

    return document.render();
}

module.exports = {
    SVG,

    getTraits,
    randomTraits,
    getSvg
}
