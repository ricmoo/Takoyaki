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
    return ethers.getDefaultProvider(process.env.NETWORK || "homestead");
})();


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
    let info = await ethers.utils.resolveProperties({
        name: "foobar",
//        address: Provider.resolveName()
    });

    let name = Buffer.from("44GK44Gv44GE44GK44GU44GW44GE44G+44GZ", "base64").toString(); //"foobar";
    let punycodeName = punycode.toASCII(name + ".takoyaki.cafe");

    // @TODO: detect any Japanese character and use a Japanese description

    return {
        name: name,
        description: `Hello! I am a Takoyaki NFT. My name is ${ JSON.stringify(name) }. I like coffee.`,
        image: `https://takoyaki.nftmd.com/svg/${ tokenId }/`,
        url: `https://${ punycodeName }/`,

        takoyakiSeeds: [ ],
        takoyakiInfo: {
            owner: "0x1234",
            address: "0x1234",
            expires: 1234,
        },
        takoyakiTraits: {
            version: "0.0.1",
            eyes: "eyes-6"
        }
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
        if (match = pathname.match(/^\/(json|svg|png)\/([0-9a-f]{64})$/)) {
            redirect(response, `/${ match[1] }/${ match[2] }/`);

        } else if (match = pathname.match(/^\/svg\/([0-9a-f]{64})\/$/)) {
            let tokenId = match[1];
            let traits = takoyaki.randomTraits();
            let svg = takoyaki.getSvg(5, traits);
            send(svg, ContentTypes.SVG, {
                "Content-Disposition": `inline; filename="takoyaki-${ tokenId.substring(0, 10) }.svg"`
            });

        } else if (match = pathname.match(/^\/png\/([0-9a-f]{64})\/$/)) {
            let tokenId = match[1];
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

            // Render the SVG file
            let traits = takoyaki.randomTraits();
            let svg = takoyaki.getSvg(5, traits);
            getConverter().convert(svg, options).then((png) => {
                send(png, ContentTypes.PNG, {
                    "Content-Disposition": `inline; filename="takoyaki-${ tokenId.substring(0, 10) }.png"`
                });
            }, (error) => {
                console.log(error);
                sendError(500, "Server Error");
            });

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
