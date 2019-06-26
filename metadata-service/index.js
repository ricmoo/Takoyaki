"use strict";

const fs = require("fs");
const http = require('http');
const queryParse = require('querystring').parse;
const { resolve } = require("path");
const urlParse = require('url').parse;

const takoyaki = require("takoyaki");

//console.log("Warning: Using local debug takoyaki library...");
//const takoyaki = require("../lib");

const { createConverter } = require("convert-svg-to-png");
const ethers = require("ethers");
const punycode = require('punycode');


const Port = (process.env.PORT || 5000);
const Server = 'meta.takoyaki.cafe/0.0.1';

const Provider = (function() {
    const ProviderOptions = {
        infura: "6189cea41bac431286af08a06df219be",
        etherscan: undefined
    };
//    return ethers.getDefaultProvider(process.env.NETWORK || "homestead");
    return ethers.getDefaultProvider(process.env.NETWORK || "ropsten");
})();

const TakoyakiContract = takoyaki.connect(Provider);

const ContentTypes = {
    HTML: "text/html; charset=utf-8",
    JSON: "application/json; charset=utf-8",
    PNG: "image/png",
    SVG: "image/svg+xml",
    TXT: "text/plain",
};

function now() { return (new Date()).getTime(); }

const getConverter = (function() {
    let converter = null;
    let lastConverterTime = null;

    function getConverter() {
        if (!converter) {
            converter = createConverter({
                puppeteer: {
                    args: [ '--no-sandbox' ]
                }
            });
        }
        lastConverterTime = now();
        return converter;
    }

    setInterval(() => {
        if (converter && (now() - lastConverterTime > 30000)) {
            converter.destroy();
            converter = null;
        }
    }, 10000);

    return getConverter;
})();


function redirect(response, location) {
    response.writeHead(301, {
        Location: location
    }, "Moved Permanently");
    response.end();
}

async function getJson(tokenId) {
    let traits = await TakoyakiContract.getTraits("0x" + tokenId);

    // @TODO: detect any Japanese character and use a Japanese description

    traits.genes.upkeepFee = ethers.utils.formatEther(traits.genes.upkeepFee)

    let parts = [ "1", Buffer.from(traits.genes.name).toString("hex"), traits.genes.salt.substring(2) ];
    traits.genes.seeds.forEach((seed) => {
        if (!seed) { return; }
        parts.push(seed.substring(2));
    });
    let imageUrl = "https:/" + "/takoyaki.nftmd.com/svg/" + parts.join("_");

    return {
        name: traits.genes.name,
        description: `Hello! I am a Takoyaki. My name is ${ JSON.stringify(traits.genes.name) }.`,
        image: imageUrl,
        url: takoyaki.labelToUrl(traits.genes.name),

        takoyakiTraits: traits,
    };
}

const server = http.createServer((request, response) => {
    function send(body, contentType, extraHeaders) {
        let headers = {
            "Server": Server,
        };

        if (request.headers["origin"]) {
            headers["Access-Control-Allow-Origin"] = "*";
        }
        if (request.headers["access-control-request-method"]) {
            headers["Access-Control-Allow-Methods"] = "GET, OPTIONS, POST";
        }
        if (request.headers["access-control-request-headers"]) {
            headers["Access-Control-Allow-Headers"] = "X-Requested-With";
        }

        if (body != null) {
            let length = ((typeof(body) === "string") ? Buffer.byteLength(body): body.length);
            headers["Content-Length"] = length;
            headers["Content-Type"] = contentType;
        }

        Object.keys(extraHeaders || {}).forEach((key) => {
            headers[key] = extraHeaders[key];
        });

        response.writeHead(200, headers);
        if (body != null) {
            response.end(body);
        } else {
            response.end();
        }
    }

    function sendError(code, reason) {
        response.writeHead(code, reason, {
            "Server": Server
        });
        response.end();
    }


    let url = null;
    try {
        url = urlParse(request.url);
    } catch (error) {
        return sendError(400, 'Bad URL');
    }

    if (request.method === 'GET') {
        if (request.headers["x-forwarded-proto"] === "http") {
            return redirect(response, `https://${ request.headers["host"] }${ request.url }`);
        }

        let pathname = url.pathname.toLowerCase();
        let match = null;

        // Redirect non-directory paths to the directory path
        if (match = pathname.match(/^\/(json|svg|png)\/(random|[0-9a-f_]+)$/)) {
            redirect(response, `/${ match[1] }/${ match[2] }/`);

        } else if (match = pathname.match(/^\/(svg|png)\/(random|[0-9a-f_]+)\/$/)) {
            let kind = match[1];
            let parts = match[2].split("_");

            let filename = null;
            let traits = null;
            if (parts.length === 1 && parts[0] === "random") {
                filename = "random";
                traits =  takoyaki.getTraits();
            } else {
                parts = parts.slice(1);
                traits = takoyaki.getTraits({
                    name: Buffer.from(parts[0], "hex").toString(),
                    salt: ("0x" + parts[1]),
                    seeds: parts.slice(2).map((seed) => ("0x" + seed))
                });
                filename = ethers.utils.id(traits.genes.name).substring(0, 10);
            }

            let svg = takoyaki.getSvg(traits);

            if (kind === "svg") {
                send(svg, ContentTypes.SVG, {
                    "Content-Disposition": `inline; filename="takoyaki-${ filename }.svg"`
                });

            } else if (kind === "png") {
                let query = queryParse(url.query);

                // Get the dimensions for the image
                // - Default: 256x256
                // - Must be a positive integer
                // - Must be <= 1024x1024
                let options = { height: 256, width: 256 };
                try {
                    if (query.size != null) {
                        if (!query.size.match(/^[0-9]+$/)) {
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

                getConverter().convert(svg, options).then((png) => {
                    send(png, ContentTypes.PNG, {
                        "Content-Disposition": `inline; filename="takoyaki-${ filename }.png"`
                    });
                }, (error) => {
                    console.log(error);
                    sendError(500, "Server Error");
                });
            }

        } else if (match = pathname.match(/^\/json\/([0-9a-f]{64})\/$/)) {
            getJson(match[1]).then((json) => {
                send(JSON.stringify(json, null, 2), ContentTypes.JSON);
            }, (error) => {
                console.log(error);
                sendError(500, "Server Error");
            });

        } else {
            sendError(404, 'Not Found');
        }

    } else if (request.method === "POST") {
        sendError(404, "Not Found");

    } else if (request.method === 'OPTIONS') {
        response.send(204, "No Content", {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
            "Access-Control-Allow-Headers": "X-Requested-With",
            "Server": Server
        });
        response.end();

    } else {
        sendError(400, 'Unsupported Method')
    }
})

server.listen(Port, () => {
    console.log('takoyaki.nftmd.com API is running on port: ' + Port);
});
