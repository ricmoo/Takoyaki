"use strict";

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
const Server = "takoyaki.cafe/0.0.1";
const Domain = null; //"takoyaki";

const Provider = (function() {
    const ProviderOptions = {
        infura: "ec7f689b45f148f899533b26547e4276",
        etherscan: undefined
    };
//    return ethers.getDefaultProvider(process.env.NETWORK || "homestead");
    return ethers.getDefaultProvider(process.env.NETWORK || "ropsten");
})();

const TakoyakiContract = takoyaki.connect(Provider);

const ContentTypes = Object.freeze({
    HTML: "text/html; charset=utf-8",
    JSON: "application/json; charset=utf-8",
    JS:   "application/javascript",
    CSS:  "text/css",
    PNG:  "image/png",
    SVG:  "image/svg+xml",
    TXT:  "text/plain",
});

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


async function getJson(tokenId) {
    let traits = await TakoyakiContract.getTraits("0x" + tokenId);

    // @TODO: detect any Japanese character and use a Japanese description

    traits.genes.upkeepFee = ethers.utils.formatEther(traits.genes.upkeepFee)

    let parts = [ "1", Buffer.from(traits.genes.name).toString("hex"), traits.genes.salt.substring(2) ];
    traits.genes.seeds.forEach((seed) => {
        if (!seed) { return; }
        parts.push(seed.substring(2));
    });
    let imageUrl = "https:/" + "/takoyaki.nftmd.com/png/" + parts.join("_") + "/";

    return {
        name: traits.genes.name,
        description: `Hello! I am a Takoyaki. My name is ${ JSON.stringify(traits.genes.name) }.`,
        image: imageUrl,
        url: takoyaki.labelToUrl(traits.genes.name),

        takoyakiTraits: traits,
    };
}

function getOpenGraph(name) {
    let result = [ ];
    result.push(`<meta property="og:title" content="${ name }" />`);
    result.push(`<meta property="og:type" content="website" />`);
    result.push(`<meta property="og:description" content="Hello, please. I is a Takoyaki NFT! My name is ${ name }. Much Hugs." />`);
    result.push(`<meta property="og:url" content="${ takoyaki.labelToUrl(name) }" />`);
    result.push(`<meta property="og:image:alt" content="Takoyaki: a pancake octopus ball" />`);
    result.push(`<meta property="og:image:url" content="https://takoyaki.cafe/profile/${ Buffer.from(name).toString("hex") }" />`);
    result.push(`<meta property="og:image:type" content="${ ContentTypes.PNG }" />`);
    result.push(`<meta property="og:image:height" content="600" />`);
    result.push(`<meta property="og:image:width" content="600" />`);
    return result.join("\n    ");
}


function handler(request, response) {
    function send(body, contentType, extraHeaders) {
        let headers = {
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

    function redirect(location) {
        response.writeHead(301, {
            Server: Server,
            Location: location
        }, "Moved Permanently");
        response.end();
    }

    function sendError(code, reason) {
        response.writeHead(code, reason, {
            "Server": Server
        });
        response.end();
    }


    let host = request.headers.host.split(":")[0];
    let pathname = null;
    let query = { };
    let method = request.method;

    try {
        let url = urlParse(request.url);
        pathname = url.pathname.toLowerCase();
        if (pathname === "/") { pathname = "/index.html"; }
        if (url.query) {
            query = queryParse(url.query);
        }
    } catch (error) {
        return sendError(400, 'Bad URL');
    }

    console.log(host, pathname, query);

    if (method === "GET" && pathname === "/_debug") {
        return send(JSON.stringify({
            headers: request.headers,
            url: request.url,
            method: request.method,
            rawHeaders: request.rawHeaders,
        }), ContentTypes.JSON);
    }


    if (method === 'GET') {

        // Redirect insecure requests to secure ones
        //if (request.headers["x-forwarded-proto"] === "http") {
        //    return redirect(`https://${ request.headers["host"] }${ request.url }`);
        //}

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
            const html = Static["/index.html"].replace("<!-- OpenGraph -->", getOpenGraph(takoyaki.urlToLabel(host)));
            return send(html, ContentTypes.HTML);
        }

        // Static file from ./static
        // URL: https://takoyaki.cafe/FILENAME
        if (Static[pathname]) {
            return send(Static[pathname], ContentTypes[pathname.toUpperCase().split(".")[1]] || "application/octet-stream");
        }

        let match = null;

        // Redirect non-directory paths to the directory path
        if (match = pathname.match(/^\/(json|svg|png|profile)\/([0-9a-f_]+)$/)) {
            return redirect(`/${ match[1] }/${ match[2] }/`);

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

                let svg = takoyaki.getSvg(traits);

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

                    return getConverter().convert(svg, options).then((png) => {
                        return send(png, ContentTypes.PNG, {
                             "Content-Disposition": `inline; filename="takoyaki-${ filename }.png"`
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
        // URL: https://takoyaki.cafe/json/TOKEN_ID
        } else if (match = pathname.match(/^\/json\/([0-9a-f]{64})\/$/)) {
            return getJson(match[1]).then((json) => {
                return send(JSON.stringify(json, null, 2), ContentTypes.JSON);
            }, (error) => {
                console.log(error);
                return sendError(500, "Server Error");
            });

        // Image request by hex(LABEL); SVG only
        } else if (match = pathname.match(/^\/profile\/(([0-9a-f][0-9a-f])*)\/$/)) {
            let name = takoyaki.normalizeLabel(Buffer.from(match[1], "hex").toString());
            return getJson(ethers.utils.id(name).substring(2)).then((json) => {
                const filename = ethers.utils.id(json.takoyakiTraits.genes.name).substring(0, 10);
                let svg = takoyaki.getSvg(json.takoyakiTraits, takoyaki.getLabelColor(name));
                let options = { height: 600, width: 600 };
                return getConverter().convert(svg, options).then((png) => {
                    return send(png, ContentTypes.PNG, {
                         "Content-Disposition": `inline; filename="takoyaki-${ filename }.png"`
                    });
                }, (error) => {
                    console.log(error);
                    return sendError(500, "Server Error");
                });
            }, (error) => {
                console.log(error);
                return sendError(500, "Server Error");
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
    console.log('takoyaki.nftmd.com API is running on port: ' + Port);
});
