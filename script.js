(function () {

    // Setup the background. Center tiles of Takoyaki across the entire
    // background, highlighting them randomly
    (function () {
        const Background = document.getElementById("background");

        const Card = document.getElementById("card");
        const Search = document.getElementById("search");

        // Center (x, y) coordinate (updated in fillBackground)
        //let cx = 400, cy = 300;

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

        // Create a single Takoyaki tile for teh background
        function createTakoyakiFace(label, traits) {
            let div = document.createElement("div");
            div.style.background = Takoyaki.getLabelColor(label);
            div.innerHTML = Takoyaki.getSvg(traits);

            let span = document.createElement("span");
            span.textContent = label;
            div.appendChild(span);

            return div;
        }

        function createTakoyakiTile(id) {
            let tile = document.createElement("div");
            tile.className = "tile";
            tile.id = id;
            Background.appendChild(tile);

            let front = document.createElement("div");
            tile.appendChild(front);

            let back = document.createElement("div");
            back.classList.add("backface")
            tile.appendChild(back);

            let current = 1;

            SetTile[id] = function(label, traits) {
                let div = (current % 2) ? back: front;

                div.style.background = Takoyaki.getLabelColor(label);
                div.style.borderColor = Takoyaki.getLabelColor(label, 90, 50);

                if (current > 1) {
                    div.classList.add("highlight");
                    setTimeout(() => { div.classList.remove("highlight"); }, 1000);
                }

                div.innerHTML = Takoyaki.getSvg(traits);

                let span = document.createElement("span");
                span.textContent = label;
                div.appendChild(span);

                front.style.transform = "rotateY(" + (current * 180) + "deg)";
                current++;
                back.style.transform = "rotateY(" + (current * 180) + "deg)";

                tile.style.zIndex = current;
                tile.classList.add("flipping");
                setTimeout(() => { tile.classList.remove("flipping"); }, 3500);
            };

            return tile;
        }

        // Fills the background with Takoyaki tiles (centered)
        const SetTile = { };
        function fillBackground() {
            //cx = window.innerWidth / 2;
            //cy = window.innerHeight / 2;

            let ox = ((window.innerWidth % 165) - 160) / 2;
            let oy = ((window.innerHeight % 165) - 160) / 2;
            let i = 0;
            for (let x = 0; x < window.innerWidth + 165; x += 165) {
                let j = 0;
                for (let y = 0; y < window.innerHeight + 165; y += 165) {
                    let id = "tile_" + i + "_" + j;
                    let tmp = document.getElementById(id);
                    if (!tmp) {
                        let label = "foobar" + x + " " + y;
                        let traits = Takoyaki.randomTraits();
                        tmp = createTakoyakiTile(id);
                        SetTile[id](label, traits);
                    }
                    tmp.style.transform = ("translate(" + (ox + x) + "px, " + (oy + y) + "px)");
                    j++;
                }
                i++;
            }
        }

        fillBackground();
        window.onresize = fillBackground;

        function highlight() {
            let tiles = Array.prototype.filter.call(Background.children, isVisible);
            let tile = tiles[parseInt(Math.random() * tiles.length)];
            SetTile[tile.id]("ff" + (new Date()).getTime(), Takoyaki.randomTraits());
        }
        setInterval(highlight, 12000);
        highlight();
    })();

    // The label we are viewing (or "" for the root)
    const label = (function () {
        let comps = location.hostname.split(".");

        // Testing on locahost:8000/?LABEL_HERE
        if (comps.length === 1) {
            let label = location.search.substring(1).trim();
            if (label) { label = decodeURIComponent(location.search.substring(1)); }
            return label;
        }

        // takoyaki.cafe
        if (comps === 2) { return ""; }

        // LABEL_HERE.takoyaki.cafe
        return decodeURIComponent(comps[0]);
    })();

    function getLink(label) {
        let comps = location.hostname.split(".");

        // Testing on locahost:8000/?LABEL_HERE
        if (comps.length === 1) {
            return "http://localhost:8000/?" + encodeURIComponent(label);
        }

        return "https://" + encodeURIComponent(label) + ".takoyaki.cafe";
    }

    // Connect to whatever provider we can
    const { providerPromise, getSigner } = (function () {
        //const supported = { homestead: true, ropsten: true };
        const supported = { ropsten: true };
        const defaultNetwork = "ropsten";

        if (window.ethereum) {
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

                lastNetwork = network.chainId;
                setTimeout(checkNetwork, 1000);

                if (!supported[network.name]) {
                    return Promise.reject(new Error("unsupported network"));
                }

                return network;
            });

            let providerPromise = networkPromise.then((network) => {
                return new ethers.providers.Web3Provider(ethereum);
            }, (error) => {
                return ethers.getDefaultProvider(defaultNetwork)
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
            providerPromise: Promise.resolve(ethers.getDefaultProvider(defaultNetwork)),
            getSigner: () => Promise.resolve(null)
        };
    })();

    async function register(label) {

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

        console.log(dustWallet);
    }

    // Root search view
    if (label === "") {
        const Search = document.getElementById("search");
        Search.style.display = "block";

        let input = document.getElementById("input-search");
        let button = document.getElementById("button-search");

        input.onkeyup = function (event) {
            if (!button.classList.contains("enabled")) { return; }
            if (event.which === 13) {
                location.href = getLink(input.value);
            }
        }

        input.oninput = function () {
            button.classList[input.value.length ? "add" : "remove"]("enabled")
        }

        button.onclick = function () {
            if (!button.classList.contains("enabled")) { return; }
            location.href = getLink(input.value);
        }

    } else {
        const Card = document.getElementById("card");
        Card.style.display = "block";
        document.getElementById("label").textContent = label;

        let img = document.getElementById("takoyaki");
        let traits = Takoyaki.randomTraits();
        traits.state = 5;

        let traitsDraw = ethers.utils.shallowCopy(traits);
        traitsDraw.state = 0;
        img.innerHTML = Takoyaki.getSvg(traitsDraw);


        // Already done... Animate eating the shell.
        if (traits.state > 4) {
            for (let i = 0; i < 6; i++) {
                (function (i) {
                    setTimeout(() => {
                        traitsDraw.state = i
                        img.innerHTML = Takoyaki.getSvg(traitsDraw);
                    }, i * 200);
                })(i);
            }
            //return true;
        }
    }

    //register("foobar");

})();
