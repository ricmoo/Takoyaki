"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require('http');
const queryParse = require('querystring').parse;
const { resolve } = require("path");
const urlParse = require('url').parse;

//console.log("WARNING: Using local debug takoyaki library... ****************************");
//const takoyaki = require("../lib");

const takoyaki = require("takoyaki");

const { createConverter } = require("convert-svg-to-png");
const ethers = require("ethers");

const Static = (function() {
    let Static = { }
    fs.readdirSync("./static/").forEach((filename) => {
        Static["/" + filename] = fs.readFileSync("./static/" + filename).toString();
    });
    return Object.freeze(Static);
})();

const Port = (process.env.PORT || 5000);
const Server = "takoyaki.cafe/0.0.2";
const Domain = null; //"takoyaki";

const Local = (process.env.LOCAL === "true");
console.log("Local:", Local);

const upload = (function() {
    const AWS = require("aws-sdk");

    AWS.config.credentials = new AWS.Credentials(
        process.env.REVEAL_ACCESS_KEY_ID,
        process.env.REVEAL_SECRET_ACCESS_KEY
    );

    const s3 = new AWS.S3();

    const RevealBucket = process.env.REVEAL_BUCKET;

    return function(content) {
        const dataLength = ethers.utils.hexDataLength(content);
        if (typeof(content) !== "string" || dataLength == null || dataLength > 480) {
            return Promise.reject(new Error("invalid content"));
        }

        const hash = ethers.utils.keccak256(content);

        return new Promise((resolve, reject) => {
            Provider.getBlockNumber().then((blockNumber) => {
                const params = {
                    ACL: "private",
                    Body: hash,
                    Bucket: RevealBucket,
                    ContentType: "text/plain",
                    Key: `commit/${ Network }/${ blockNumber }/${ content.substring(2) }.txt`
                };

                s3.putObject(params, function(error, data) {
                    if (error) { return reject(error); }
                    return resolve(hash);
                });
            }, (error) => {
                reject(error);
            });
        });
    }
})();

const Network = (process.env.NETWORK || "ropsten");
const Provider = (function() {
    const ProviderOptions = {
        infura: "ec7f689b45f148f899533b26547e4276",
        etherscan: undefined
    };
    return ethers.getDefaultProvider(Network);
})();

const TakoyakiContract = takoyaki.connect(Provider);

const ContentTypes = Object.freeze({
    HTML: "text/html; charset=utf-8",
    ICO:  "image/x-icon",
    JSON: "application/json; charset=utf-8",
    JS:   "application/javascript",
    CSS:  "text/css",
    PNG:  "image/png",
    SVG:  "image/svg+xml",
    TXT:  "text/plain",
});

function now() { return (new Date()).getTime(); }

const MAX_CONVERTERS = 5;
const MAX_PENDING_PER_CONVERTER = 25;

let _nextCid = 1;
const _converters = [ ];
const _stats = { lastTime: 0, inUse: 0, frameCount: 0, total: 0, mean: [ ] };

function getStats() {
    const result = _stats.mean.slice();
    if (_stats.frameCount) {
        result.push(_stats.inUse / _stats.frameCount);
    }

    return {
        total: _stats.total,
        means: result
    };
}

function getConverter() {
    let converter = null;

    _stats.inUse += _converters.reduce((accum, c) => (accum + c.length()), 0);
    _stats.frameCount++;
    _stats.total++;
    if ((now() - _stats.lastTime) > 60000) {
        if (_stats.frameCount) {
            _stats.mean.push(_stats.inUse / _stats.frameCount);
            while (_stats.mean.length > 20) { _stats.mean.shift(); }
        }
        _stats.inUse = 0;
        _stats.frameCount = 0;
        _stats.lastTime = now();
    }

    // Look for a converter with no work...
    for (let i = 0; i < _converters.length; i++) {
        if (_converters[i].length() === 0) {
            converter = _converters[i];
            break;
        }
    }
    if (!converter) {

        // Create a new converter if we have space...
        if (_converters.length < MAX_CONVERTERS) {
            let id = _converters.length;
            console.log("Creating new Converter:", id);
            const instance = createConverter({ puppeteer: { args: [ '--no-sandbox' ] } });
            const convert = instance.convert.bind(instance);
            const inflight = [ ];
            const triggerNext = function(cid) {
                if (inflight.length === 0 || inflight[0].cid !== cid) {
                    console.log("What?!", id, inflight[0].cid, cid);
                    return;
                }
                inflight.shift();
                if (inflight.length) {
                    let ready = inflight[0];
                    ready.resolve({ id: id, convert: convert, done: function() { triggerNext(ready.cid); } });
                }
            }
            const queue = function(resolve, reject) {
                const cid = _nextCid++;
                inflight.push({ id, cid, resolve, reject });
                if (inflight.length === 1) {
                    let ready = inflight[0];
                    ready.resolve({ id: id, convert: convert, done: function() { triggerNext(ready.cid); } });
                }
            }
            converter = {
                id: id,
                queue: queue,
                length: function() { return inflight.length; }
            };
            _converters.push(converter);

        } else {
            // Find the least busy converter...
            let converters = _converters.slice();
            converters.sort((a, b) => (a.length() - b.length()));
            if (converters[0].length() < MAX_PENDING_PER_CONVERTER) { converter = converters[0]; }
        }
    }

    // Still no converter for us to use...
    if (converter == null) {
        console.log("Error: no converters available");
        _converters.forEach((converter) => {
            console.log(`  Converter #${ converter.id }: ${ converter.length() }`);
        });
        throw new Error("no converters available");
    }

    // Queue the request for a converter
    return new Promise((resolve, reject) => {
        converter.queue(resolve, reject);
    });
}

// @TODO: Make this more fun and dynamic.
function getDescription(name) {
    /*
    const Openings = [
        "Hello, please.",
        "Happy today!",
        "Felicitations!",
        "I see you.",
    ];
    const Closing = [
        "Much hugs.",
        "*poke poke*",
        "*heart emoji*",
        "Nice to see you!",
        "*blink*",
    ];
    */
    return `Hello, please. I is a Takoyaki NFT! My name is ${ name }. Much Hugs.`;
}

async function getJson(tokenId) {
    let traits = await TakoyakiContract.getTraits("0x" + tokenId);
    if (traits.state !== 5) { return null; }

    // @TODO: detect any Japanese character and use a Japanese description

    traits.genes.upkeepFee = ethers.utils.formatEther(traits.genes.upkeepFee)

    let parts = [ "1", Buffer.from(traits.genes.name).toString("hex"), traits.genes.salt.substring(2) ];
    traits.genes.seeds.forEach((seed) => {
        if (!seed) { return; }
        parts.push(seed.substring(2));
    });
    let imageUrl = "https:/" + "/takoyaki.cafe/png/" + parts.join("_") + "/";

    return {
        name: traits.genes.name,
        description: getDescription(traits.genes.name),
        image: imageUrl,
        url: takoyaki.labelToUrl(traits.genes.name),

        takoyakiTraits: traits,
    };
}

function escapeHtml(text, extra) {
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    if (extra) {
        if (extra.indexOf('"')) {
            text = text.replace('"', "&quot;");
        }
    }
    return text;
}

const DayNames = Object.freeze([ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ]);
const MonthNames = Object.freeze([ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ]);

function getDateHeader(date) {
    function pad(value) {
        value = "00" + String(value);
        return value.substring(value.length - 2);
    }

    if (date == null) { date = 0; }
    if (typeof(date) === "number") { date = new Date(now() + date); }

    return (
        DayNames[date.getUTCDay()] + ", " +
        pad(date.getUTCDate()) + " " + MonthNames[date.getUTCMonth()] + " " + date.getUTCFullYear() + " " +
        [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join(":") + " " +
        "GMT"
    );
}

function getOpenGraph(name) {
    const imageUrl = `https://takoyaki.cafe/profile/${ Buffer.from(name).toString("hex") }/`;
    const description = escapeHtml(getDescription(name), '"');

    let result = [ ];

    // Open Graph Info
    result.push(`<meta property="og:title" content="${ escapeHtml(name, '"') }" />`);
    result.push(`<meta property="og:type" content="website" />`);
    result.push(`<meta property="og:description" content="${ description }" />`);
    result.push(`<meta property="og:url" content="${ takoyaki.labelToUrl(name) }" />`);

    // Open Graph Image
    result.push(`<meta property="og:image" content="${ imageUrl }" />`);
    result.push(`<meta property="og:image:alt" content="Takoyaki: a pancake octopus ball" />`);
    result.push(`<meta property="og:image:url" content="${ imageUrl }" />`);
    result.push(`<meta property="og:image:type" content="${ ContentTypes.PNG }" />`);
    result.push(`<meta property="og:image:height" content="600" />`);
    result.push(`<meta property="og:image:width" content="600" />`);

    // TWitter Card
    result.push(`<meta property="twitter:title" content="${ escapeHtml(name, '"') }" />`);
    result.push(`<meta property="twitter:card" content="summary" />`);
    result.push(`<meta property="twitter:description" content="${ description }" />`);
    result.push(`<meta property="twitter:site" content="@TakoyakiNFT" />`);
    result.push(`<meta property="twitter:image" content="${ imageUrl }" />`);
    result.push(`<meta property="twitter:image:alt" content="Takoyaki: a pancake octopus ball" />`);

    return result.join("\n    ");
}


function handler(request, response) {
    function send(body, contentType, extraHeaders) {
        let headers = {
            "Date": getDateHeader(),
            "Server": Server,
        };

        // Add CORS headers
        if (request.headers["origin"]) {
            headers["Access-Control-Allow-Origin"] = "*";
        }
        if (request.headers["access-control-request-method"]) {
            headers["Access-Control-Allow-Methods"] = "GET, OPTIONS, POST";
        }
        if (request.headers["access-control-request-headers"]) {
            headers["Access-Control-Allow-Headers"] = "X-Requested-With";
        }

        // Add the body and relevant headers
        if (body != null) {
            let length = ((typeof(body) === "string") ? Buffer.byteLength(body): body.length);
            headers["Content-Length"] = String(length);
            headers["Content-Type"] = contentType;
            headers["Etag"] = `"${ ethers.utils.sha256(Buffer.from(body)).substring(2) }"`;
        }

        Object.keys(extraHeaders || {}).forEach((key) => {
            headers[key] = extraHeaders[key];
        });

        response.writeHead(200, "OK", headers);
        if (body != null && request.method !== "HEAD") {
            response.end(body);
        } else {
            response.end();
        }
    }

    function redirect(location) {
        response.writeHead(301, {
            "Date": getDateHeader(),
            "Server": Server,
            "Location": location
        }, "Moved Permanently");
        response.end();
    }

    function sendError(code, reason) {
        response.writeHead(code, reason, {
            "Date": getDateHeader(),
            "Server": Server
        });
        response.end();
    }


    let host = request.headers.host.split(":")[0];
    let pathname = null;
    let query = { };
    let queryText = "";
    let method = request.method;

    try {
        let url = urlParse(request.url);
        pathname = url.pathname.toLowerCase();
        if (pathname === "/") { pathname = "/index.html"; }
        if (url.query) {
            queryText = "?" + url.query;
            query = queryParse(url.query);
        }
    } catch (error) {
        return sendError(400, 'Bad URL');
    }

    console.log("Req:", host, pathname, queryText);

    if (method === "GET" && pathname === "/_debug") {
        return send(JSON.stringify({
            headers: request.headers,
            url: request.url,
            method: request.method,
            converterStats: getStats(),
        }, null, 2), ContentTypes.TXT, {
            "Cache-Control": "no-cache"
        });
    }


    if (method === 'GET' || method === "HEAD") {

        // Get the label (and perform sanity checks on the URL)
        const label = takoyaki.urlToLabel(host);
        {
            let comps = host.split(".");
            try {
                if (comps.length < 2) { throw new Error("too few components"); }

                if (["cafe", "local"].indexOf(comps.pop()) === -1) { throw new Error("unknown TLD"); }
                if (comps.pop() !== Domain && Domain) { throw new Error("unknown domain"); }
                if (comps.length > 1) { throw new Error("too many components"); }
                if (comps.length && !comps[0]) { throw new Error("empty label"); }
                if ((comps.length !== 0 && !label)) { throw new Error("label mismatch"); }
            } catch (error) {
                console.log(`Error: ${ host } (${ error.message })`);
                return sendError(400, "Bad URL");
            }
        }

        // URL: https://LABEL.takoyaki.cafe/
        if (label) {
            if (pathname !== "/index.html") { return sendError(404, "Not Found"); }
            let html = Static["/index.html"].replace("<!-- OpenGraph -->", getOpenGraph(takoyaki.urlToLabel(host)));
            // Replace 'data:prod="-" src="./lib/foo/' => 'https://takoyaki.cafe/'
            html = html.replace(/data:prod="-" ([a-z]+)="([^"]+)\//ig, (all, attr, value) => {
                console.log(all, attr, value);
                if (Local) {
                    return `${ attr }="http://takyaki.local:5000/`;
                }
                return `${ attr }="https://takoyaki.cafe/`;
            });
            return send(html, ContentTypes.HTML);
        }

        // Static file from ./static
        // URL: https://takoyaki.cafe/FILENAME
        if (Static[pathname]) {
            const contentType = ContentTypes[pathname.toUpperCase().split(".")[1]] || "application/octet-stream";
            return send(Static[pathname], contentType);
        }

        let match = null;

        // Redirect non-directory paths to the directory path
        if (match = pathname.match(/^\/(json|svg|png|profile)\/([0-9a-f_]+)$/)) {
            return redirect(`/${ match[1] }/${ match[2] }/${ queryText }`);

        // Image
        // URL: https://takoyaki.cafe/svg/TOKENID/
        // URL: https://takoyaki.cafe/png/TOKENID/
        // URL: https://takoyaki.cafe/png/TOKENID/?size=SIZE
        } else if (match = pathname.match(/^\/(svg|png)\/([0-9a-f_]+)\/$/)) {
            try {
                const kind = match[1];
                const parts = match[2].split("_").slice(1);

                const traits = takoyaki.getTraits({
                    name: Buffer.from(parts[0], "hex").toString(),
                    salt: ("0x" + parts[1]),
                    seeds: parts.slice(2).map((seed) => ("0x" + seed))
                });
                const filename = ethers.utils.id(traits.genes.name).substring(0, 10);

                let background = ((query.nobg != null) ? undefined: takoyaki.getLabelColor(traits.genes.name));

                let svg = takoyaki.getSvg(traits, background);

                if (kind === "svg") {
                    return send(svg, ContentTypes.SVG, {
                        "Content-Disposition": `inline; filename="takoyaki-${ filename }.svg"`
                    });

                } else if (kind === "png") {

                    // Get the dimensions for the image
                    // - Default: 256x256
                    // - Must be a positive integer
                    // - Must be <= 1024x1024
                    let options = { height: 256, width: 256 };
                    try {
                        if (query.size != null) {
                            if (!query.size.match(/^[1-9][0-9]+$/)) {
                                throw new Error("invalid size: " + query.size);
                            }
                            let size = parseInt(query.size);
                            if (size > 1024) { size = 1024; }
                            options.height = options.width = size;
                        }
                    } catch (error) {
                        console.log(error);
                        return sendError(400, "Bad PNG Dimension");
                    }

                    return getConverter().then((converter) => {
                        converter.convert(svg, options).then((png) => {
                            converter.done();
                            return send(png, ContentTypes.PNG, {
                                 "Content-Disposition": `inline; filename="takoyaki-${ filename }.png"`
                            });
                        }, (error) => {
                            console.log(error);
                            converter.done();
                            return sendError(500, "Server Error");
                        });
                    }, (error) => {
                        console.log(error);
                        return sendError(500, "Server Error");
                    });
                }

            } catch (error) {
                console.log(error);
                return sendError(500, "Server Error");
            }

        // NFT (ERC-721) JSON metadata url
        // URL: https://takoyaki.cafe/json/TOKEN_ID/
        } else if (match = pathname.match(/^\/json\/([0-9a-f]{64})\/$/)) {
            return getJson(match[1]).then((json) => {

                // Not hatched yet...
                if (json == null) {
                    return sendError(404, "Not Found");
                }

                return send(JSON.stringify(json, null, 2), ContentTypes.JSON);
            }, (error) => {
                console.log(error);
                return sendError(500, "Server Error");
            });

        // Image request by hex(LABEL); SVG only
        // URL: takoyaki.cafe/profile/HEX_LABEL/
        } else if (match = pathname.match(/^\/profile\/(([0-9a-f][0-9a-f])*)\/$/)) {

            let name = takoyaki.normalizeLabel(Buffer.from(match[1], "hex").toString());

            let extraHeaders = {
                "Content-Disposition": `inline; filename="takoyaki-${ ethers.utils.id(name).substring(2, 12) }.png"`
            };

            return getJson(ethers.utils.id(name).substring(2)).then((json) => {

                // This token is unhatched...
                if (json == null) {
                    let traits = takoyaki.getTraits();
                    traits.state = 0;
                    json = { takoyakiTraits: traits };
                    extraHeaders["Cache-Control"] = "max-age=30";
                }

                let svg = takoyaki.getSvg(json.takoyakiTraits, takoyaki.getLabelColor(name));
                let options = { height: 600, width: 600 };
                return getConverter().then((converter) => {
                    converter.convert(svg, options).then((png) => {
                        converter.done();
                        return send(png, ContentTypes.PNG, extraHeaders);
                    }, (error) => {
                        console.log(error);
                        converter.done();
                        return sendError(500, "Server Error");
                    })
                }, (error) => {
                    console.log(error);
                    return sendError(500, "Server Error");
                });
            }, (error) => {
                console.log(error);
                return sendError(500, "Server Error");
            });

        } else if (match = pathname.match(/^\/reveal\/(([0-9a-f][0-9a-f])*)\/$/)) {
            const reveal = match[1];
            upload("0x" + reveal).then((hash) => {
                return send(JSON.stringify({ success: true, hash: hash }), ContentTypes.JSON, {
                    "Cache-Control": "no-cache"
                });
            }, (error) => {
                console.log(error);
                return send(JSON.stringify({ success: false, error: "unknown error" }), ContentTypes.JSON, {
                    "Cache-Control": "no-cache"
                });
            });


        } else {
            return sendError(404, 'Not Found');
        }

    } else if (method === "POST") {
        return sendError(404, "Not Found");

    // Enable CORS
    } else if (method === 'OPTIONS') {
        return response.send(204, "No Content", {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
            "Access-Control-Allow-Headers": "X-Requested-With",
            "Server": Server
        });
        response.end();

    } else {
        return sendError(400, 'Unsupported Method')
    }
}

const server = http.createServer(handler);
server.listen(Port, () => {
    console.log('App: takoyaki.cafe is running on port: ' + Port);
});
