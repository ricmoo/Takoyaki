let address = "0x1c043fC72B1Ae63F6389023B15E799E7Efdc60C0";
let abi = [
    "function test(bytes32 txPreimage, bytes32 rx) view public returns (address)"
];
let contract = new Contract(address, abi, provider);

(async function() {
    let toAddress = await provider.resolveName("ricmoo.firefly.eth");
    let network = await provider.getNetwork();

    let tx = {
        to: toAddress,
        value: utils.parseEther("0.1"),
        chainId: network.chainId,
    };
    console.log(tx);

    let r = utils.randomBytes(32);

    let serializedUnsigned = utils.serializeTransaction(tx);
    let txPreimage = keccak256(serializedUnsigned);
    console.log("Unsigned:", serializedUnsigned);
    console.log("txPreimage:", txPreimage);

    let serializedTx = utils.serializeTransaction(tx, {
        r: r,
        s: "0x0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead",
        recoveryParam: 0
    });

    console.log("Signed", serializedTx);
    console.log("TX", utils.parseTransaction(serializedTx));

    let addr = await contract.test(txPreimage, r);
    console.log("Would:", addr);
})();
