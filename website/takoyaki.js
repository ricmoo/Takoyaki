(async function() {

    let label = location.search.substring(1);

    let comps = location.hostname.split(".");
    if (comps.length > 2) { label = comps[0]; }

    document.getElementById("label").textContent = label;

    function random(seed) {
        let value = parseInt(ethers.utils.id(seed).substring(2, 10), 16);
        return value / 0xffffffff;
    }

    function getRandomColor(seed, hue, dHue, sat, dSat, lum, dLum) {
        hue = (720 + hue - (dHue / 2) + random(seed + "-hue") * dHue) % 360;
        sat += random(seed + "-sat") * dSat;
        lum += random(seed + "-lum") * dLum;
        console.log("B", hue, sat, lum);
        return "hsl(" + parseInt(hue) + ", " + parseInt(sat) + "%, " + parseInt(lum) + "%)";
    }

    /*
    function getColor(genes) {
        let hue = genes % 360;
        hue /= 360;
        let sat = genes % 20;
        
        return {
            hue: genes % 360,
            
        };
    }
    */

    function hide(svg, ids, keepIndex) {
        if (keepIndex == null) { keepIndex = 0; }
        ids.forEach((id, index) => {
            if (index === keepIndex) { return; }
            svg.getElementById(id).style.opacity = 0;
        });
    }

    async function prepareTako(fresh) {
        let traits = { seed: "", spots: false, color1: 200 };
        let done = false;
        let state = 0;
        if (!fresh) {
            const registrar = new ethers.Contract(contractAddress, ABI, provider);

            let randomIndex = await registrar.randomIndex(ethers.utils.namehash(label + ".takoyaki.eth"));
            let height = await registrar.getHeight();
            let promises = [];

            for (let i = randomIndex; i < height; i++) {
                promises.push(registrar.getRandomValueAtHeight(i));
            }

            let randomValues = await Promise.all(promises);

            traits.seed = randomValues[0];

            // Propably modulo-bias issues... It's late and we're sleepy. :)
            // Also, these should use bit-voting...
            try {
                traits.color1 = (parseInt(randomValues[0].substring(2, 6), 16)) % 360;
                traits.color2 = (parseInt(randomValues[1].substring(6, 10), 16)) % 360;
                traits.spots = (((parseInt(randomValues[2].substring(10, 14), 16)) % 3) == 0);
                traits.eyes = (parseInt(randomValues[2].substring(10, 14), 16)) % 4;
                traits.mouth = (parseInt(randomValues[3].substring(14, 18), 16)) % 4;
                traits.hat = (parseInt(randomValues[4].substring(18, 22), 16)) % 4;
                traits.star = (((parseInt(randomValues[2].substring(22, 26), 16)) % 3) == 0);
            } catch (error) {
                console.log(error, "not enough values...");
            }

            state = randomValues.length;
        }
        console.log(traits);

        const takoyaki = document.getElementById("takoyaki").getSVGDocument();
        console.log(takoyaki, state);


        takoyaki.getElementById("takoyaki-4").style.opacity = 0;
        takoyaki.getElementById("takoyaki-3").style.opacity = 0;
        takoyaki.getElementById("takoyaki-2").style.opacity = 0;
        takoyaki.getElementById("takoyaki-1").style.opacity = 0;

        hide(takoyaki, [ "mouth-1", "mouth-2", "mouth-3", "mouth-4" ], traits.mouth);

        if (traits.star) {
            takoyaki.getElementById("star").style.opacity = 1;
        }

        if (state == 0) {
            takoyaki.getElementById("takoyaki-4").style.opacity = 1;
        } else if (state == 1) {
            takoyaki.getElementById("takoyaki-3").style.opacity = 1;
        } else if (state == 2) {
            takoyaki.getElementById("takoyaki-2").style.opacity = 1;
        } else if (state == 3) {
            takoyaki.getElementById("takoyaki-1").style.opacity = 1;
        }

        takoyaki.getElementById("spots").style.opacity = 0;
        if (traits.spots) {
            takoyaki.getElementById("spots").style.opacity = 1;
            Array.prototype.forEach.call(takoyaki.getElementById("spots").children, (el) => {
                el.style.fill = getRandomColor(traits.seed, traits.color1, 10, 80, 10, 40, 10);
            });
        }

        takoyaki.getElementById("star").style.opacity = 0;
        /*
        if (traits.star || true) {
            takoyaki.getElementById("star").style.opacity = 1;
            takoyaki.getElementById("star").style.fill = getRandomColor(traits.seed, traits.color1, 90, 80, 10, 40, 10);
        }
        */

        let base = ethers.BigNumber.from(ethers.utils.randomBytes(32));


        takoyaki.getElementById("body").children[0].style.fill = getRandomColor(traits.seed, traits.color1, 40, 50, 20, 60, 10);
        for (let i = 1; i <= 5; i++) {
            takoyaki.getElementById("foot-" + String(i)).children[0].style.fill = getRandomColor(traits.seed, traits.color1, 40, 65, 15, 70, 15);
        }

        return (state >= 4);
    }


    const provider = await ethereum.send("eth_chainId", [ ]).then((result) => {
        return ethers.getDefaultProvider(ethers.BigNumber.from(result.result).toNumber());
    });

    const contractAddress = "0x6C7c09740209c9c3EdcF65971D4616FFf0054621";

    const ABI = [
        "function isValidLabel(string label) public view returns (bool)",
        "function reveal(string label, bytes32 randomValue, address owner) public",
        "function fee() public view returns (uint256)",
        "function commit(bytes32 txPreimage) public payable returns (address)",
        "function getHeight() public view returns (uint48)",
        "function randomIndex(bytes32 nodehash) public view returns (uint48)",
        "function getRandomValueAtHeight(uint48 height) public view returns (bytes32)",
        "event Commit(address indexed funder, bytes32 indexed txPreimage, bytes32 rx)",
        "event Registered(string label, address indexed owner)"
    ];

    async function getSigner() {
        let allowed = await ethereum.enable();
        let provider = new ethers.providers.Web3Provider(ethereum);
        let signer = provider.getSigner(allowed[0]);
        console.log("SSS", signer);
        return signer;
    }

    async function register(label) {
        const signer = await getSigner();
        const registrar = new ethers.Contract(contractAddress, ABI, signer);

        let gasPrice = await provider.getGasPrice();
        let owner = await signer.getAddress();

        let randomValue = ethers.utils.hexlify(ethers.utils.randomBytes(32));

        // The future transaction to reveal our name
        let revealTx = await registrar.populateTransaction.reveal(label, randomValue, owner);
        revealTx.nonce = 0;
        revealTx.chainId = provider.getNetwork().then(n => n.chainId);
        revealTx.gasPrice = gasPrice.mul(11).div(10);
        revealTx.gasLimit = 250000;

        revealTx = await ethers.utils.resolveProperties(revealTx);
        console.log("Reveal Later:", revealTx);

        let revealPreimage = ethers.utils.keccak256(ethers.utils.serializeTransaction(revealTx));

        // Commit our request
        let commitTx = await registrar.commit(revealPreimage, {
            gasPrice: gasPrice,
            gasLimit: 500000,
            value: ethers.utils.parseEther("0.1")
        });

        let receipt = await commitTx.wait();
        console.dir(receipt, { depth: null });
        let serializedReveal = ethers.utils.serializeTransaction(revealTx, {
            r: receipt.events[0].values[2],
            s: "0x0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead",
            recoveryParam: 0
        });
        console.log(serializedReveal);
        console.log(ethers.utils.parseTransaction(serializedReveal));

        let tx = await provider.sendTransaction(serializedReveal);
        console.log(tx);

        receipt = await provider.waitForTransaction(tx.hash);
        console.log(receipt);

        await prepareTako(false);

        return owner;
    }

    async function loadAddress(address) {
        if (address == null) {
             address = await provider.resolveName(label + ".takoyaki.eth");
        }
        if (address) {
            address = [
                address.substring(0, 10),
                address.substring(10, 18),
                address.substring(18, 26),
                address.substring(26, 34),
            ].join(" ");

            document.getElementById("address").textContent = address;

            let done = await prepareTako(false);
            if (!done) {
                function update() {
                    prepareTako(false).then((done) => {
                        console.log("checking", done);
                        if (done) { provider.off("block", update); }
                    });
                }
                provider.on("block", update);
            }
        } else {
            prepareTako(true);

            let button = document.getElementById("buy");
            button.classList.add("enabled");
            button.onclick = function() {
                if (!button.classList.contains("enabled")) { return; }
                button.classList.remove("enabled");
                button.classList.add("running");
                register(label).then((address) => {
                    button.remove();
                    loadAddress(address);
                }, (error) => {
                    button.classList.add("enabled");
                    button.classList.remove("running");
                });
            }
        }
    }
    loadAddress();

})();
