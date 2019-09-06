"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var punycode_1 = require("punycode");
var aes_js_1 = __importDefault(require("aes-js"));
var ethers_1 = require("ethers");
var asset_1 = require("./asset");
var random_1 = require("./random");
var svg_parser_1 = require("./svg-parser");
var Takoyaki = svg_parser_1.parse(asset_1.svg);
var _random = new random_1.Random("0x");
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
var Count = {
    eyes: 20,
    mouth: 20,
    tattoo: 114
};
function _getTraits(genes) {
    var state = 5;
    //if (!genes.commitBlock || !genes.seeds[0]) {
    if (!genes.seeds[0]) {
        state = 0;
    }
    else if (!genes.seeds[1]) {
        state = 1;
        // } else if (!genes.revealBlock || !genes.seeds[2]) {
    }
    else if (!genes.seeds[2]) {
        state = 2;
    }
    else if (!genes.seeds[3]) {
        state = 3;
    }
    else if (!genes.seeds[4]) {
        state = 4;
    }
    // For partially revealed Takoyaki, the image is hidden, so we can just
    // populate the hashes with anything (reuse the salt) so the math works
    var base = new random_1.Random([genes.salt, (genes.seeds[0] || genes.salt)]);
    var eyes = base.subRandom(genes.seeds[1] || genes.salt);
    var mouth = eyes.subRandom(genes.seeds[2] || genes.salt);
    var tattoo = mouth.subRandom(genes.seeds[3] || genes.salt);
    var color1 = base.range("color", 0, 360);
    var color2 = mouth.range("color", 0, 360);
    return {
        genes: genes,
        state: state,
        eyes: eyes.range("_", 0, Count.eyes),
        // Mouth with rotation and scale
        mouth: mouth.range("_", 0, Count.mouth),
        mouth_r: mouth.range("rotate", -8, 9),
        mouth_s: mouth.choice("flip", [1, -1]) * (mouth.range("scale", 100, 185) / 100),
        tattoo: tattoo.range("_", -1, Count.tattoo),
        tattoo_d: tattoo.range("distance", 0, 50),
        tattoo_a: tattoo.range("angle", 0, 360),
        tattoo_r: tattoo.range("rotate", 0, 30),
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
        tentacle1_r: base.range("rotate1", -15, 26),
        tentacle2_r: base.range("rotate2", -25, 26),
        tentacle3_r: base.range("rotate3", -25, 26),
        tentacle4_r: base.range("rotate4", -20, 10),
    };
}
function getLabelColor(label, sat, lum) {
    if (sat == null) {
        sat = 90;
    }
    if (lum == null) {
        lum = 90;
    }
    return _random.color(label, 0, 360, sat, 0, lum, 0);
}
exports.getLabelColor = getLabelColor;
function getTraits(genes) {
    if (!genes) {
        var rand = random_1.Random.random();
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
exports.getTraits = getTraits;
function createList(prefix, count) {
    var result = [];
    for (var i = 1; i <= count; i++) {
        result.push(prefix + i);
    }
    return result;
}
function show(document, ids, keepIndex) {
    if (keepIndex == null) {
        keepIndex = -1;
    }
    var result = null;
    ids.forEach(function (id, index) {
        try {
            var el = document.getElementById(id);
            if (index === keepIndex) {
                result = el;
            }
            else {
                el.remove();
            }
        }
        catch (error) {
            console.log(id);
            throw error;
        }
    });
    return result;
}
function setFill(node, fill) {
    (node.children || []).forEach(function (child) {
        if (svg_parser_1.SvgNode.isNode(child)) {
            child.attributes.style = "fill: " + fill;
            setFill(child, fill);
        }
    });
}
function getSvg(traits, backgroundColor) {
    var document = Takoyaki.clone();
    // Show only the valid part of the shell (possibly none)
    show(document, createList("takoyaki-", 5), 4 - traits.state);
    // Show the Tako shadow only when it is fully revealed
    show(document, ["shadow-tako"], (traits.state >= 5) ? 0 : -1);
    // Fix the clipping path (Adobe Illustrator and SVG don't seem
    // to agree on how to do this);
    var clipping = document.getElementById("body-2-clip_1_");
    (clipping.children[0]).attributes["xlink:href"] = "#body-2-clip";
    // Eyes
    show(document, createList("eyes-", Count.eyes), traits.eyes);
    // Mouth
    var mouth = show(document, createList("mouth-", Count.mouth), traits.mouth);
    if (mouth) {
        // The pivot point of the mouth
        var mouthBox = document.getElementById("mouth-box");
        var transformOrigin = (parseInt(mouthBox.attributes["cx"]) + "px " +
            parseInt(mouthBox.attributes["cy"]) + "px");
        var scale = ("scale(" + traits.mouth_s + ", " + Math.abs(traits.mouth_s) + ")");
        var rotate = ("rotate(" + traits.mouth_r + "deg)");
        var transform = scale + " " + rotate;
        // Scale and rotate the mouth a little bit
        var style = "transform-origin: " + transformOrigin + "; transform: " + transform;
        mouth.attributes.style = style;
    }
    // Tattoo
    var tattoo = show(document, createList("tattoo-", Count.tattoo), traits.tattoo);
    if (tattoo) {
        // The center pivot to rotate and translate the tattoo from
        var tattooBox = document.getElementById("tattoo-box");
        var transformOrigin = (parseInt(tattooBox.attributes["cx"]) + "px " +
            parseInt(tattooBox.attributes["cy"]) + "px");
        var dist = parseInt(tattooBox.attributes["r"]) * traits.tattoo_d / 100;
        var dx = dist * Math.cos(traits.tattoo_a);
        var dy = dist * Math.sin(traits.tattoo_a);
        var translate = ("translate(" + parseInt(String(dx)) + "px, " + parseInt(String(dy)) + "px)");
        var rotate = ("rotate(" + (traits.tattoo_r - 15) + "deg)");
        var transform = translate + " " + rotate;
        var style = "transform-origin: " + transformOrigin + "; transform: " + transform + "; fill: " + traits.tattoo_c;
        setFill(tattoo, traits.tattoo_c);
        tattoo.attributes.style = style;
    }
    // Set the body color
    document.getElementById("body").attributes.style = "fill: " + traits.body_c;
    // Set the tentacle colors and rotation
    createList("tentacle-", 4).forEach(function (id) {
        document.getElementById(id + "-c1").attributes.style = "fill: " + traits[id.replace("-", "") + "_outside_c"];
        // The pivot point for the tentacle
        var tentacleBox = document.getElementById(id + "-box");
        var transformOrigin = (parseInt(tentacleBox.attributes["cx"]) + "px " +
            parseInt(tentacleBox.attributes["cy"]) + "px");
        var rotate = ("rotate(" + (traits[id.replace("-", "") + "_r"]) + "deg)");
        // Rotate the tentacle a little bit
        var style = "transform-origin: " + transformOrigin + "; transform: " + rotate;
        document.getElementById(id).attributes.style = style;
    });
    // The inner color of the two middle tentacles
    ["tentacle-2", "tentacle-3"].forEach(function (id) {
        document.getElementById(id + "-c2").attributes.style = "fill: " + traits[id.replace("-", "") + "_inside_c"];
    });
    // Optionally set a background color (otherwise transparent)
    if (backgroundColor) {
        var style = document.svg.attributes.style || "";
        style += "; background-color: " + backgroundColor;
        document.svg.attributes.style = style;
    }
    return document.render();
}
exports.getSvg = getSvg;
var RevealPublicKey = "0x02a9722b874612e4ef7282918bf05d55d6b2874eb2161ae5cebfb1b57058a89040";
function submitReveal(signedTx) {
    var ephemeralKey = new ethers_1.utils.SigningKey(ethers_1.utils.randomBytes(32));
    var key = ethers_1.utils.keccak256(ephemeralKey.computeSharedSecret(RevealPublicKey));
    var crypter = new aes_js_1.default.ModeOfOperation.ctr(ethers_1.utils.arrayify(key));
    var reveal = ethers_1.utils.hexlify(ethers_1.utils.concat([
        "0x01",
        ephemeralKey.compressedPublicKey,
        crypter.encrypt(ethers_1.utils.arrayify(ethers_1.utils.RLP.encode([
            signedTx
        ])))
    ]));
    return ethers_1.utils.fetchJson("http://takoyaki.local:5000/reveal/" + reveal.substring(2) + "/").then(function (result) {
        if (result.hash !== ethers_1.utils.keccak256(reveal)) {
            throw new Error("hash mismatch");
        }
        return reveal;
    });
}
exports.submitReveal = submitReveal;
function getDelta(date) {
    function pad(v) {
        var result = String(v);
        while (result.length < 2) {
            result = "0" + result;
        }
        return result;
    }
    var remaining = date - ((new Date()).getTime() / 1000);
    var display = [];
    var clump = 24 * 60 * 60;
    if (remaining > clump) {
        var days = parseInt(String(remaining / clump));
        remaining -= days * clump;
        display.push(String(days) + "d");
    }
    clump = 60 * 60;
    if (remaining > clump || display.length) {
        var hours = parseInt(String(remaining / clump));
        remaining -= hours * clump;
        display.push(pad(hours) + "h");
    }
    clump = 60;
    if (remaining > clump || display.length) {
        var mins = parseInt(String(remaining / clump));
        remaining -= mins * clump;
        display.push(pad(mins) + "m");
    }
    display.push(pad(parseInt(String(remaining))) + "s");
    return display.join(":");
}
function getTakoyakiUrl(tokenIdOrLabel) {
    if (tokenIdOrLabel.substring(0, 2) === "0x") {
        return "https://takoyaki.cafe/json/" + tokenIdOrLabel.substring(2);
    }
    return getTakoyakiUrl(ethers_1.utils.id(tokenIdOrLabel));
}
exports.getTakoyakiUrl = getTakoyakiUrl;
var ABI = [
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
    "event Cancelled(address indexed funder, bytes32 commitment)",
    "event Committed(address indexed funder, bytes32 commitment)",
    "event Registered(address indexed owner, uint256 indexed tokenId, string label, uint48 expires)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];
// Maps a tokenId to its name (i.e. keccak256(id) => id)
// This cache is not ever flushed, but this should not be
// an issue unless Takoyaki becomes wildly popular and people
// query a lot of them.
var tokenIdCache = {};
var TakoyakiContract = /** @class */ (function (_super) {
    __extends(TakoyakiContract, _super);
    function TakoyakiContract(addressOrName, contractInterface, signerOrProvider) {
        var _this = _super.call(this, addressOrName, contractInterface, signerOrProvider) || this;
        _this.decimals = 0;
        _this.name = "Takoyaki";
        _this.symbol = "TAKO";
        _this._blockSeedCache = {};
        return _this;
    }
    TakoyakiContract.prototype._getBlockSeed = function (blockNumber, currentBlockNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var blockTag, blockPromise, block;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        blockTag = ethers_1.utils.hexValue(blockNumber);
                        if (this._blockSeedCache[blockTag]) {
                            return [2 /*return*/, this._blockSeedCache[blockTag]];
                        }
                        blockPromise = this.provider.getBlock(blockTag);
                        // Only cache block hashes that are stable to prevent caching across re-orgs
                        if (currentBlockNumber && currentBlockNumber > blockNumber + 6) {
                            this._blockSeedCache[blockTag] = blockPromise.then(function (block) {
                                return block.hash.substring(0, 14);
                            });
                            this._blockSeedCache[ethers_1.utils.hexValue(blockNumber - 1)] = blockPromise.then(function (block) {
                                return block.parentHash.substring(0, 14);
                            });
                        }
                        return [4 /*yield*/, blockPromise];
                    case 1:
                        block = _a.sent();
                        return [2 /*return*/, block.hash.substring(0, 14)];
                }
            });
        });
    };
    TakoyakiContract.prototype.getTraits = function (tokenId, hints) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, blockNumber, traits, genes, promises, filter, values;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // The hints are used when the caller knows info not available yet. For
                        // example, a buyer knows the name and may know the commit block before
                        // the reveal, at which point the name and commit block become public.
                        if (!hints) {
                            hints = {};
                        }
                        return [4 /*yield*/, ethers_1.utils.resolveProperties({
                                blockNumber: Promise.resolve(hints.blockNumber || this.provider.getBlockNumber()),
                                traits: this.functions.getTakoyaki(tokenId)
                            })];
                    case 1:
                        _a = _b.sent(), blockNumber = _a.blockNumber, traits = _a.traits;
                        genes = {
                            generation: 0,
                            tokenId: tokenId,
                            salt: (hints.salt || traits.salt),
                            commitBlock: (hints.commitBlock || traits.commitBlock),
                            revealBlock: traits.revealBlock,
                            seeds: [],
                            name: (hints.name || tokenIdCache[tokenId] || null),
                            expires: traits.expires,
                            status: (["available", "grace", "owned"][traits.status]),
                            owner: traits.owner,
                            upkeepFee: traits.upkeepFee,
                        };
                        // Unowned; no need to load blocks
                        if (genes.commitBlock === 0) {
                            return [2 /*return*/, _getTraits(genes)];
                        }
                        promises = {};
                        if (!genes.name && genes.revealBlock) {
                            filter = this.filters.Registered(null, genes.tokenId);
                            promises.name = this.queryFilter(filter, genes.revealBlock, genes.revealBlock).then(function (events) {
                                events.forEach(function (event) {
                                    var name = event.values[2];
                                    if (ethers_1.utils.id(name) !== genes.tokenId) {
                                        console.log("WHAT?!", genes, event);
                                        return;
                                    }
                                    tokenIdCache[genes.tokenId] = name;
                                });
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
                        return [4 /*yield*/, ethers_1.utils.resolveProperties(promises)];
                    case 2:
                        values = _b.sent();
                        genes.seeds = [
                            (values.seed_c1 || null),
                            (values.seed_c3 || null),
                            (values.seed_r1 || null),
                            (values.seed_r3 || null),
                            (values.seed_r5 || null),
                        ];
                        return [2 /*return*/, _getTraits(genes)];
                }
            });
        });
    };
    TakoyakiContract.prototype.getTransactions = function (label, owner, salt, prefundRevealer) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, gasPrice, prefundBalance, fee, info, blindedCommitment, revealGasPrice, revealCost, topUp;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, ethers_1.utils.resolveProperties({
                            gasPrice: this.provider.getGasPrice(),
                            prefundBalance: (prefundRevealer ? this.provider.getBalance(prefundRevealer) : Promise.resolve(0)),
                            fee: this.functions.fee(label).catch(function (error) { throw new Error('Invalid name'); }),
                            info: this.functions.getTakoyaki(ethers_1.utils.id(label)),
                            blindedCommitment: this.functions.makeBlindedCommitment(label, owner, salt)
                        })];
                    case 1:
                        _a = _b.sent(), gasPrice = _a.gasPrice, prefundBalance = _a.prefundBalance, fee = _a.fee, info = _a.info, blindedCommitment = _a.blindedCommitment;
                        if (info.status !== 0) {
                            throw new Error("Takoyaki is not available (expires in " + getDelta(info.expires) + ")");
                        }
                        revealGasPrice = gasPrice.mul(2);
                        revealCost = revealGasPrice.mul(this.interface.functions.reveal.gas.add(21000));
                        topUp = 0;
                        if (prefundRevealer) {
                            if (prefundBalance.gte(revealCost)) {
                                prefundRevealer = ethers_1.constants.AddressZero;
                            }
                            else {
                                topUp = revealCost.sub(prefundBalance);
                            }
                        }
                        else {
                            prefundRevealer = ethers_1.constants.AddressZero;
                        }
                        return [2 /*return*/, ethers_1.utils.resolveProperties({
                                commit: this.populateTransaction.commit(blindedCommitment, prefundRevealer, topUp, {
                                    gasPrice: gasPrice,
                                    value: fee.add(topUp)
                                }),
                                reveal: this.populateTransaction.reveal(label, owner, salt, {
                                    gasPrice: revealGasPrice
                                })
                            })];
                }
            });
        });
    };
    TakoyakiContract.prototype.tokenURI = function (tokenId) {
        return getTakoyakiUrl(tokenId);
    };
    return TakoyakiContract;
}(ethers_1.Contract));
function urlToLabel(url) {
    var comps = (url || "").split(".");
    if (comps.length !== 3 || comps[1] !== "takoyaki") {
        return null;
    }
    return punycode_1.toUnicode(comps[0]);
}
exports.urlToLabel = urlToLabel;
function labelToUrl(label, local) {
    if (local) {
        return "http://" + punycode_1.toASCII(label.toLowerCase()) + ".takoyaki.local:8000/";
    }
    return "https://" + punycode_1.toASCII(label.toLowerCase()) + ".takoyaki.cafe";
}
exports.labelToUrl = labelToUrl;
function normalizeLabel(label) {
    return punycode_1.toUnicode(punycode_1.toASCII(label.toLowerCase()));
}
exports.normalizeLabel = normalizeLabel;
function connect(signerOrProvider) {
    return new TakoyakiContract("takoyaki.eth", ABI, signerOrProvider);
}
exports.connect = connect;
