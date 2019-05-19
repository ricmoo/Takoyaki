function getResolver(address) {
    let ABI = [
        "function addr(bytes32 nodehash) constant returns (address)",
        "function setAddr(bytes32 nodehash, address addr)",
        "function interfaceImplementer(bytes32 nodehash, bytes4 interfaceID) view returns (address)"
    ];
    return new Contract(address, ABI, provider);
}

(async function () {
    let ABI = [
        "function resolver(bytes32 nodehash) view returns (address)"
    ];
    let network = await provider.getNetwork();
    let ENS = new Contract(network.ensAddress, ABI, provider);

    let EthControllerResolverAddress = await ENS.resolver(namehash("eth"));

    let EthControllerResolver = getResolver(EthControllerResolverAddress);
    let EthControllerAddress = await EthControllerResolver.interfaceImplementer(namehash("eth"), "0x018fac06")

    let EthControllerABI = [
        "function commit(bytes32 commitment) public",
        "function makeCommitment(string name, address owner, bytes32 secret) pure public returns(bytes32)",
        "function register(string name, address owner, uint duration, bytes32 secret) external payable",
        "function available(string name) public view returns(bool)"
    ];

    let EthController = new Contract(EthControllerAddress, EthControllerABI, accounts[0]);
    let secret = "0x76d02eb51e78f6162216e025b84bded31d9f73c9641f724f272348e9cd6babc4";

    let name = "penguins";
    let owner = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

    let commitment = await EthController.makeCommitment(name, owner, secret);
    console.log(commitment);

    if (false) {
        let tx = await EthController.commit(commitment);
        let receipt = await tx.wait();
        console.log(receipt);
    } else {
        let tx = await EthController.register(name, owner, (3600 * 30 * 365), secret, {
            gasLimit: 500000,
            value: parseEther("1.0")
        });
        let receipt = await tx.wait();
        console.log(receipt);
    }

    /*
    console.log(EthController);
    let a = await EthController.available("cobourg3");
    console.log(a);
    */
})();
