"use strict";

const fs = require("fs");

const ethers = require("ethers");

const takoyaki = require("../lib");

const provider = ethers.getDefaultProvider("ropsten");
const Takoyaki = takoyaki.connect(provider);

function escapeChar(value) {
    value = value.toString(16);
    while (value.length < 4) { value = "0" + value; }
    return "\\u" + value;
}

function escape(text) {
    let bytes = ethers.utils.toUtf8Bytes(text);

    let result = "";
    let i = 0;

    while (i < bytes.length) {
        let c = bytes[i++];

        if (c >> 7 === 0) {
            result += String.fromCharCode(c);
            continue;
        }

        // Multibyte; how many bytes left for this character?
        let extraLength = null;
        let overlongMask = null;

        // 110x xxxx 10xx xxxx
        if ((c & 0xe0) === 0xc0) {
            extraLength = 1;
            overlongMask = 0x7f;

        // 1110 xxxx 10xx xxxx 10xx xxxx
        } else if ((c & 0xf0) === 0xe0) {
            extraLength = 2;
            overlongMask = 0x7ff;

        // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
        } else if ((c & 0xf8) === 0xf0) {
            extraLength = 3;
            overlongMask = 0xffff;

        } else {
            if ((c & 0xc0) === 0x80) {
                throw new Error("invalid utf8 byte sequence; unexpected continuation byte");
            }
            throw new Error("invalid utf8 byte sequence; invalid prefix");
        }

        // Do we have enough bytes in our data?
        if (i + extraLength > bytes.length) {
            throw new Error("invalid utf8 byte sequence; too short");
        }

        // Remove the length prefix from the char
        let res = c & ((1 << (8 - extraLength - 1)) - 1);

        for (let j = 0; j < extraLength; j++) {
            let nextChar = bytes[i];

            // Invalid continuation byte
            if ((nextChar & 0xc0) != 0x80) {
                res = null;
                break;
            };
            res = (res << 6) | (nextChar & 0x3f);
            i++;
        }

        if (res === null) {
            throw new Error("invalid utf8 byte sequence; invalid continuation byte");
        }

        // Check for overlong seuences (more bytes than needed)
        if (res <= overlongMask) {
            throw new Error("invalid utf8 byte sequence; overlong");
        }

        // Maximum code point
        if (res > 0x10ffff) {
            throw new Error("invalid utf8 byte sequence; out-of-range");
        }

        // Reserved for UTF-16 surrogate halves
        if (res >= 0xd800 && res <= 0xdfff) {
            throw new Error("invalid utf8 byte sequence; utf-16 surrogate");
        }

        if (res <= 0xffff) {
            result += escapeChar(res);
            continue;
        }

        res -= 0x10000;
        result += escapeChar(((res >> 10) & 0x3ff) + 0xd800);
        result += escapeChar((res & 0x3ff) + 0xdc00);
    }

    return result;
}


(async function() {
    const output = [ ];

    let logs = await Takoyaki.queryFilter("Registered", 0, "latest");
    logs.forEach((log) => {
        console.log(log);
        output.push({
            tokenId: log.values[1].toHexString(),
            name: log.values[2],
        });
    });

    return output;
})().then(async (tokens) => {
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].seeds) { continue; }

        let traits = await Takoyaki.getTraits(tokens[i].tokenId);
        tokens[i].salt = traits.genes.salt;
        tokens[i].seeds = traits.genes.seeds;
    }
    console.log(tokens, tokens.length);

    fs.writeFileSync("history.js", `const TakoyakiHistory = ${ escape(JSON.stringify(tokens)) };`);
});

// @TODO:
//   - Check that the state is 5
//   - Continue from the last block in the existing history
