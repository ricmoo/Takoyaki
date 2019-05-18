let _p = null;
(async function() {
    const provider = await ethereum.send("eth_chainId", [ ]).then((result) => {
        return ethers.getDefaultProvider(ethers.BigNumber.from(result.result).toNumber());
    });
    _p = provider;

    const address = "0x93530fE41F3aE010eEb383Cc0872E9Bc050F5eC8";

    const ABI = [
        "function isValidLabel(string label) public view returns (bool)",
        "function reveal(string label, address owner) public",
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

        // The future transaction to reveal our name
        let revealTx = await registrar.populateTransaction.reveal(label, owner);
        revealTx.nonce = 0;
        revealTx.chainId = provider.getNetwork().then(n => n.chainId);
        revealTx.gasPrice = gasPrice.mul(11).div(10);
        revealTx.gasLimit = 30000;

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

        let tx = provider.sendTransaction(serializedReveal);
        console.log(tx);

    }

    register("hello-world");

})();
