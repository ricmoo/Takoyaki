(function() {

    function getSvg(traits) {
        return Takoyaki.getSvg(traits).replace("<?xml version=\"1.0\" encoding=\"utf-8\"?>", "");
    }

    // Setup the background. Center tiles of Takoyaki across the entire
    // background, highlighting them randomly
    {
        const Background = document.getElementById("background");

        const Card = document.getElementById("card");
        const Search = document.getElementById("search");

        // Maps Tile id to function(label, traits) to reveal
        const SetTile = { };

        let lastHighlight = -1;

        // Returns true if the element is not covered by the Card/Search
        // and not too far over the edge
        function isVisible(el) {
            let cx = window.innerWidth / 2;
            let cy = window.innerHeight / 2;

            let panel = null;
            if (Card.style.display === "block") {
                panel = Card.getBoundingClientRect();
            } else if (Search.style.dispaly === "block") {
                panel = Search.getBoundingClientRect();
            } else {
                return true;
            }

            let box = el.getBoundingClientRect();

            // Find the 75% point for the quadrant of the screen
            let point = { x: box.left + 0.25 * box.width, y: box.top + 0.25 * box.height };
            if (point.x > cx) { point.x += box.width / 2; }
            if (point.y > cy) { point.y += box.height / 2; }

            // Ensure 75% visible against window
            if (point.x < 0 || point.x > window.innerWidth || point.y < 0 || point.y > window.innerHeight) {
                return false;
            }

            // Find the 75% point for the quadrant behind the panel (Card or Search)
            point = { x: box.left + 0.5 * box.width, y: box.top + 0.5 * box.height };
            //if (point.x < cx) { point.x += box.width / 2; }
            //if (point.y < cy) { point.y += box.height / 2; }

            // Ensure 50% visible against the panel (Card or Search)
            if (point.x < panel.left || point.x > panel.right || point.y < panel.top || point.y > panel.bottom) {
                return true;
            }

            return false;
        }

        let nextZIndex = 1;

        function createTakoyakiTile(id) {
            let tile = document.createElement("div");
            tile.className = "tile";
            tile.id = id;
            tile.style.zIndex = nextZIndex++;
            Background.appendChild(tile);

            let _front = document.createElement("div");
            _front.className = "backdrop";
            tile.appendChild(_front);

            let front = document.createElement("div");
            _front.appendChild(front);

            let _back = document.createElement("div");
            _back.className = "backdrop";
            tile.appendChild(_back);

            let back = document.createElement("div");
            _back.appendChild(back);

            let current = 1;

            SetTile[id] = function(label, traits) {
                let div = (current % 2) ? back: front;

                div.style.background = Takoyaki.getLabelColor(label);
                div.style.borderColor = Takoyaki.getLabelColor(label, 90, 50);

                if (current > 2) {
                    div.classList.add("highlight");
                    setTimeout(() => { div.classList.remove("highlight"); }, 4000);
                }
                current++;

                div.innerHTML = getSvg(traits);

                tile.style.zIndex = nextZIndex++;

                let span = document.createElement("span");
                span.textContent = label;
                div.appendChild(span);

                _back.style.transform = "rotateY(" + (current * 180) + "deg) translateZ(0.1px)";
                _front.style.transform = "rotateY(" + ((current + 1) * 180) + "deg) translateZ(0.1px)";
            };

            return tile;
        }

        // Fills the background with Takoyaki tiles (centered)
        function fillBackground() {
            document.body.classList.remove("animated");

            let inflight = 0;

            let ox = ((window.innerWidth % 165) - 160) / 2;
            let oy = ((window.innerHeight % 165) - 160) / 2;
            let i = 0;
            for (let x = 0; x < window.innerWidth + 165; x += 165) {
                let j = 0;
                for (let y = 0; y < window.innerHeight + 165; y += 165) {
                    let id = "tile_" + i + "_" + j;
                    let tmp = document.getElementById(id);
                    if (!tmp) {
                        lastHighlight = (lastHighlight + 1) % TakoyakiHistory.length;
                        let genes = TakoyakiHistory[lastHighlight];
                        tmp = createTakoyakiTile(id);
                        SetTile[id](genes.name, Takoyaki.getTraits(genes));

                        // In Chrome, it only allocates a back-buffer once a non-visible
                        // backface has been shown at least once, so we flip it before
                        // animations are enabled below
                        (function(id, genes) {
                            inflight++;
                            setTimeout(function() {
                                SetTile[id](genes.name, Takoyaki.getTraits(genes));
                                inflight--;
                                if (inflight === 0) {
                                    setTimeout(function() {
                                        document.body.classList.add("animated");
                                    }, 10);
                                }
                            }, 0);
                        })(id, genes);
                    }
                    tmp.style.transform = ("translate3d(" + (ox + x) + "px, " + (oy + y) + "px, 0)");
                    j++;
                }
                i++;
            }
        }

        fillBackground();
        window.onresize = fillBackground;

        function highlight() {
            if (document.visibilityState != null && document.visibilityState !== "visible") {
                return;
            }
            let tiles = Array.prototype.filter.call(Background.children, isVisible);
            let tile = tiles[parseInt(Math.random() * tiles.length)];

            lastHighlight = (lastHighlight + 1) % TakoyakiHistory.length;
            let genes = TakoyakiHistory[lastHighlight];
            SetTile[tile.id](genes.name, Takoyaki.getTraits(genes));
        }
        setInterval(highlight, 12000);
    }

    // Set up the address copy; remove whitespace from the address
    {
        const address = document.getElementById("address");

        address.oncopy = function(event) {
            event.clipboardData.setData("text/plain", address.textContent.replace(/\s/g, ""));
            event.preventDefault();
        };
    }

    // Set up the searchbar
    {
        const searchbar = document.getElementById("searchbar");

        let lastValue = searchbar.value;
        searchbar.oninput = function(event) {
            const value = searchbar.value;
            if (ethers.utils.toUtf8Bytes(value).length > 20 || value.match(/\.|\s/)) {
                searchbar.value = lastValue;
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            lastValue = value;
            return true;
        }

        searchbar.onkeyup = function(event) {
            if (event.which === 13) {
                location.href = Takoyaki.labelToUrl(searchbar.value, local);
            }
        };
    }

    // The label we are viewing (or "" for the root)
    // (for debugging, modify /etc/hosts to include LABEL.takoyaki.local and takoyaki.local)
    const label = Takoyaki.urlToLabel(location.hostname);
    const local = (location.hostname.split(".").pop() === "local");

    const errors = {
        UNSUPPORTED_NETWORK: "UNSUPPORTED_NETWORK"
    };

    // Connect to whatever provider we can
    const { providerPromise, getSigner } = (function () {
        const requiredNetwork = "ropsten";

        let providerOptions = {
            infura: "6189cea41bac431286af08a06df219be",
            etherscan: "9D13ZE7XSBTJ94N9BNJ2MA33VMAY2YPIRB",
            nodesmith: "f1b3ce218afb412bb4a6657825141885",
            alchemy: "JrWxtuwXu_V5zN5kMUCnMRpxmqmuuT_h"
        };

        if (window.ethereum) {

            // Reload the page if the network changes
            let lastNetwork = -1000;
            function checkNetwork() {
                ethereum.send("eth_chainId").then((result) => {
                    let network = ethers.providers.getNetwork(ethers.BigNumber.from(result.result).toNumber());
                    if (lastNetwork >= 0 && network.chainId !== lastNetwork) {
                        return location.reload();
                    };
                    lastNetwork = network.chainId;
                    setTimeout(checkNetwork, 1000);
                }, (error) => {
                    console.log(error);
                    setTimeout(checkNetwork, 1000);
                });
            }

            let networkPromise = ethereum.send("eth_chainId", []).then((result) => {
                let network = ethers.providers.getNetwork(ethers.BigNumber.from(result.result).toNumber());

                // Start polling for network changes
                lastNetwork = network.chainId;
                setTimeout(checkNetwork, 1000);

                if (network.name !== requiredNetwork) {
                    return Promise.reject(new Error(errors.UNSUPPORTED_NETWORK));
                }

                return network;
            });

            let providerPromise = networkPromise.then((network) => {
                return new ethers.providers.Web3Provider(ethereum);
            }, (error) => {
                return ethers.getDefaultProvider(requiredNetwork, providerOptions)
            });

            let signerPromise = null;
            let getSigner = () => {
                if (signerPromise == null) {
                    signerPromise = providerPromise.then((provider) => {
                        if (provider.getSigner == null) {
                            return Promise.reject("unsupported network");
                        }

                        return window.ethereum.enable().then((allowed) => {
                            if (allowed && allowed.length) {
                                return provider.getSigner(allowed[0]);
                            }
                            return Promise.reject(new Error("no authorized signer"));
                        });
                    });
                }
                return signerPromise;
            }

            return { providerPromise, getSigner };
        }

        return {
            providerPromise: Promise.resolve(ethers.getDefaultProvider(requiredNetwork, providerOptions)),
            getSigner: () => Promise.resolve(null)
        };
    })();

    {
        if (window.ethereum) {
            providerPromise.then((provider) => {
                if (provider.getSigner == null) {
                    document.getElementById("about-wrong-network").classList.remove("hidden");
                } else {
                    document.getElementById("about-ok").classList.remove("hidden");
                }
            });
        } else {
            document.getElementById("about-no-ethereum").classList.remove("hidden");
        }
    }

    // If iOS or Android, link MetaMask for launch into Takoyaki or install then launch into Takoyaki
    {
        const userAgentComps = [ ];
        (navigator.userAgent || navigator.vendor || window.opera || "").replace(/([a-z0-9]+)/ig, function(all, word) {
            userAgentComps.push(word.toLowerCase());
            return "";
        });

        if (userAgentComps.join(" ").match(/(ios|iphone|ipad|ipod|android)/i)) {
            const url = "https://metamask.app.link/dapp/" + location.host.split(":")[0] + "/"
            console.log("Mobile Device: Set MetaMask link = " + url);
            document.getElementById("link-metamask").setAttribute("href", url);
        }
    }


    const AdoptButton = document.getElementById("button-adopt");

    const TakoyakiContainer = document.getElementById("takoyaki");

    function draw(traits) {
        TakoyakiContainer.innerHTML = getSvg(traits);
    }

    const pendingHints = { };

    async function register(label) {
        const tokenId = ethers.utils.id(label);
        if (!pendingHints[tokenId]) { pendingHints[tokenId] = { }; }
        let hints = pendingHints[tokenId];

        const provider = await providerPromise;

        // This is a temporary wallet we will use to issue the reveal. It doesn't
        // matter if it is lost as it will only have a bit more than dust in it,
        // just enough to cover the cost of the reveal. If we ever re-use it though
        // we can spare bloating the network with extra dust accounts and save a
        // little ourselves. This allows a second transaction without needing to
        // pop-up the MetaMask UI a second time.
        const dustWallet = (function() {
            let dustMnemonic = localStorage.getItem("dust-wallet-mnemonic");
            if (!ethers.utils.isValidMnemonic(dustMnemonic)) {
                let wallet = ethers.Wallet.createRandom();
                localStorage.setItem("dust-wallet-mnemonic", wallet.mnemonic);
                return wallet.connect(provider);
            }
            return ethers.Wallet.fromMnemonic(dustMnemonic).connect(provider);
        })();

        console.log("Dust Wallet:", dustWallet.address);

        let signer = await getSigner();
        let owner = await signer.getAddress();

        let takoyaki = Takoyaki.connect(signer);

        // Use a deterministic salt, so we can recalculate the same value as
        // long as we have the dust wallet
        let salt = ethers.utils.keccak256(await dustWallet.signMessage("salt:" + label));
        hints.salt = ethers.utils.keccak256(ethers.utils.concat([ tokenId, salt ]));

        let txs = await takoyaki.getTransactions(label, owner, salt, dustWallet.address);
        console.log(txs);

        // Sign the reveal transaction
        let signedRevealTx = await dustWallet.signTransaction(txs.reveal);
        console.log("Signed Reveal Transaction:", signedRevealTx);

        // Send the transaction to the Takoyaki reveal service (encrypted)
        try {
            await Takoyaki.submitReveal(signedRevealTx);
        } catch (error) {
            console.log(error);
            throw new Error("Could not submit to reveal service");
        }

        let tx = null;

        // Send the Commit transaction
        try {
            tx = await signer.sendTransaction(txs.commit);
        } catch (error) {
            console.log(error);
            throw new Error("Cancelled Transaction.");
        }

        let receipt = await tx.wait();
        hints.commitBlock = receipt.blockNumber;
        console.log("COMMITED", receipt.blockNumber);

        // Wait for 4 blocks
        await tx.wait(4);

        // Send the reveal transaction
        console.log("Sending reveal...");
        tx = await provider.sendTransaction(signedRevealTx);
        receipt = await tx.wait();
        hints.revealBlock = receipt.blockNumber;

        return true;
    }

    // Card view of a single label
    if (label) {
        console.log("LABEL", label);

        const Card = document.getElementById("card");
        Card.style.display = "block";
        document.getElementById("label").textContent = label;
        document.getElementById("populate-label").textContent = label;

        document.title = (label + " || Takoyaki!!");

        let tokenId = ethers.utils.id(label);
        if (!pendingHints[tokenId]) { pendingHints[tokenId] = { }; }
        let hints = pendingHints[tokenId];
        hints.name = label;

        providerPromise.then((provider) => {

            const contract = Takoyaki.connect(provider);

            let polling = false;

            function check(blockNumber) {
                if (blockNumber) { hints.blockNumber = blockNumber; }

                contract.getTraits(tokenId, hints).then((traits) => {
                    draw(traits);

                    if (traits.genes.addr) {
                        document.body.classList.add("has-addr");
                        const addr = traits.genes.addr;
                        document.getElementById("addr-top").textContent = " " + addr.substring(0, 12) + " " + addr.substring(12, 22) + " ";
                        document.getElementById("addr-bottom").textContent = " " + addr.substring(22, 32) + " " + addr.substring(32, 42) + " ";
                        document.getElementById("spacer").remove();
                    }

                    if (traits.state === 5) {
                        if (polling) {
                            provider.off("block", check);
                            polling = false;
                        }
                    } else {
                        if (traits.genes.status === "available") {
                            AdoptButton.classList.add("available");
                            AdoptButton.classList.add("enabled");
                        }

                        if (!polling) {
                            provider.on("block", check);
                            polling = true;
                        }
                    }
                });
            }

            check();
        });

    // Search view
    } else {
        const Search = document.getElementById("search");
        Search.style.display = "block";
        function pulse(wait, callback) {
            setTimeout(function() {
                document.body.classList.add("pulse");
                setTimeout(function() {
                    document.body.classList.remove("pulse");
                    callback();
                }, 1);
            }, wait);
        }
        pulse(1500, function() { pulse(300); });
    }

    AdoptButton.onclick = function() {
        document.getElementById("about").classList.remove("hidden");
    };

    document.getElementById("button-close").onclick = function() {
        document.getElementById("about").classList.add("hidden");
    };

    document.getElementById("button-hatch").onclick = function() {
        document.getElementById("about").classList.add("hidden");
        AdoptButton.classList.remove("enabled");
        AdoptButton.classList.add("running");
        register(label).then(() => {
            //console.log("done?");
        }, (error) => {
            console.log(error);
            alert(error.message);
            AdoptButton.classList.remove("running");
            AdoptButton.classList.add("enabled");
        });
    };

})();
