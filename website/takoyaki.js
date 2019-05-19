(async function() {

    // @TODO: This comes from the host
    let label = location.search.substring(1);
    document.getElementById("label").textContent = label;

    function random(seed) {
        let value = parseInt(ethers.utils.id(seed).substring(2, 10), 16);
        return value / 0xffffffff;
    }

    function getRandomColor(seed, dHue, sat, dSat, lum, dLum) {
        return "hsl(120, 80%, 50%)";
        let hue = (720 + (360 * base) - (dHue / 2) + random(seed + "-hue") * dHue) % 360;
        sat += random(seed + "-sat") * dSat;
        lum += random(seed + "-lum") * dLum;
        return "hsl(" + parseInt(hue) + ", " + parseInt(sat) + "%, " + parseInt(lum) + "%)";
    }

    function prepareTako(traits, state) {
        const takoyaki = document.getElementById("takoyaki").getSVGDocument();
        console.log(takoyaki);

        takoyaki.getElementById("takoyaki-4").style.opacity = 0;
        takoyaki.getElementById("takoyaki-3").style.opacity = 0;
        takoyaki.getElementById("takoyaki-2").style.opacity = 0;
        takoyaki.getElementById("takoyaki-1").style.opacity = 0;

        if (state == 0) {
            takoyaki.getElementById("takoyaki-4").style.opacity = 1;
        } else if (state == 1) {
            takoyaki.getElementById("takoyaki-3").style.opacity = 1;
        } else if (state == 2) {
            takoyaki.getElementById("takoyaki-2").style.opacity = 1;
        } else if (state == 3) {
            takoyaki.getElementById("takoyaki-1").style.opacity = 1;
        }

        let base = ethers.BigNumber.from(ethers.utils.randomBytes(32));


        takoyaki.getElementById("body").children[0].style.fill = getRandomColor(50, 50, 20, 60, 10);
        for (let i = 1; i <= 5; i++) {
            takoyaki.getElementById("foot-" + String(i)).children[0].style.fill = getRandomColor(60, 65, 15, 70, 15);
        }
    }

    setTimeout(() => {
        prepareTako(null, 0);
    }, 1000);


    const provider = await ethereum.send("eth_chainId", [ ]).then((result) => {
        return ethers.getDefaultProvider(ethers.BigNumber.from(result.result).toNumber());
    });

    const address = "0x6C7c09740209c9c3EdcF65971D4616FFf0054621";

    const ABI = [
        "function isValidLabel(string label) public view returns (bool)",
        "function reveal(string label, bytes32 randomValue, address owner) public",
        "function fee() public view returns (uint256)",
        "function commit(bytes32 txPreimage) public payable returns (address)",
        "event Commit(address indexed funder, bytes32 indexed txPreimage, bytes32 rx)",
        "event Registered(string label, address indexed owner)"
    ];

    //const readOnlyRegistrar = new ethers.Contract(address, ABI, provider);

    async function getSigner() {
        let allowed = await ethereum.enable();
        let provider = new ethers.providers.Web3Provider(ethereum);
        let signer = provider.getSigner(allowed[0]);
        console.log("SSS", signer);
        return signer;
    }

    async function register(label) {
        const signer = await getSigner();
        const registrar = new ethers.Contract(address, ABI, signer);

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

        prepareTako(null, 1);

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
        } else {
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

    //register("hello-world");

})();
