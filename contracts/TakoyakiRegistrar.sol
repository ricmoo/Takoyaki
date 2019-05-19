pragma solidity ^0.5.7;


interface Resolver {
    function addr(bytes32 node) external view returns (address);
    function setAddr(bytes32 node, address addr) external;
}

interface AbstractENS {
    function owner(bytes32 node) external view returns(address);
    function setOwner(bytes32 node, address owner) external;
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external;
    function setResolver(bytes32 node, address resolver) external;
    function resolver(bytes32 node) view external returns (address);
}

interface ReverseRegistrar {
    function claim(address owner) external returns (bytes32 node);
}

contract TakoyakiRegistrar {

    // namehash('addr.reverse')
    bytes32 constant NODE_RR = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

    // namehash('resolver.eth')
    bytes32 constant NODE_RESOLVER = 0x844798b1177dc46bd9c9633047b7372ae21a35fd2400900442115cba3f5db1fc;

    // Standard S to use for keyless EOA
    bytes32 constant KEYLESS_S = 0x0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead;

    struct Takoyaki {
        uint48 expires;
        uint48 randomIndex;
        address owner;
    }


    event Commit(address indexed funder, bytes32 indexed txPreimage, bytes32 rx);
    event Registered(string label, address indexed owner);

    address _admin;

    AbstractENS _ens;
    bytes32 _nodehash;

    Resolver _defaultResolver;

    uint256 _fee;
    bytes32 _nextNonce;

    mapping (address => uint256) _kEoaCommits;

    mapping (bytes32 => Takoyaki) _takoyaki;

    bytes32[] _randomValues;

    uint256 _lastBlock;

    constructor(address ens, bytes32 nodehash) public {
        _ens = AbstractENS(ens);
        _nodehash = nodehash;
        _fee = (0.1 ether);
        _nextNonce = nodehash;
        _admin = msg.sender;

        // Give the admin access to the reverse entry
        ReverseRegistrar(_ens.owner(NODE_RR)).claim(_admin);

        // Setup the defaultResolver
        updateResolver();
    }

    function setAdmin(address admin) public {
        require(msg.sender == _admin);
        _admin = admin;

        // Give the admin access to the reverse entry
        ReverseRegistrar(_ens.owner(NODE_RR)).claim(admin);
    }

    function defaultResolver() public view returns (address) {
        return address(_defaultResolver);
    }

    // The "resolver.eth" name is owned by Nick Johnson, so only he
    // can update this value, after which this call may be triggered
    // to update as well.
    function updateResolver() public {
        require(msg.sender == _admin);
        _defaultResolver = Resolver(0x5FfC014343cd971B7eb70732021E26C35B744cc4); //Resolver(Resolver(_ens.resolver(NODE_RESOLVER)).addr(NODE_RESOLVER));
    }

    function fee() public view returns (uint) {
        return _fee;
    }

    function setFee(uint newFee) public {
        require(msg.sender == _admin);
        _fee = newFee;
    }

    function withdraw(uint256 amount) public {
        require(msg.sender == _admin);
        address(uint160(_admin)).transfer(amount);
    }

    function isValidLabel(string memory label) public pure returns (bool) {
        return true;
    }

    function commit(bytes32 txPreimage) public payable returns (address) {
        require(msg.value == _fee);

        // Compute the keyless EOA address
        bytes32 rx = _nextNonce;
        bytes32 s = KEYLESS_S;
        address kEoa = ecrecover(txPreimage, 27, rx, s);

        // Advance the nonce
        _nextNonce = keccak256(abi.encode(_nextNonce, txPreimage));

        // 50% chance we picked an invalid signature, try again
        if (kEoa == address(0)) { return commit(txPreimage); }

        _kEoaCommits[kEoa] = now;

        // Forward enough ether to the k-EOA to call reveal
        // - We bump the gasPrice up 10%
        // - Send enough for 150,000 gas
        address(uint160(kEoa)).transfer((tx.gasprice * 11 / 10) * 1000000);

        emit Commit(msg.sender, txPreimage, rx);

        return kEoa;
    }

    function renew(bytes32 nodehash) public payable {
        require(msg.value == _fee);

        Takoyaki storage takoyaki = _takoyaki[nodehash];

        // Must not be expired outside of grace period (implies it is registered)
        require(takoyaki.expires > (now - 30 days));

        // Must be expiring within 1 year
        require(takoyaki.expires < now + (365 days));

        // Extend by 1 year
        takoyaki.expires += (365 days);
    }

    function reveal(string memory label, bytes32 randomValue, address owner) public {
        // Must have an associated commit
        require(_kEoaCommits[msg.sender] > 0, "missing commit");

        // Name must be valid
        require(isValidLabel(label), "invalid label");

        // Clear the commit
        _kEoaCommits[msg.sender] = 0;

        bytes32 labelHash = keccak256(bytes(label));
        bytes32 nodehash = keccak256(abi.encode(_nodehash, labelHash));

        Takoyaki storage takoyaki = _takoyaki[nodehash];

        // Alrady owned and not expired
        require(takoyaki.expires < now + (30 days), "already owned");

        takoyaki.expires = uint48(now + (365 days));
        takoyaki.randomIndex = uint48(_randomValues.length);
        takoyaki.owner = owner;

        // Make this registrar the owner (so we can set it up before giving it away)
        _ens.setSubnodeOwner(_nodehash, labelHash, address(this));

        // Set up the default resolver and point to the sender
        _ens.setResolver(nodehash, address(_defaultResolver));
        _defaultResolver.setAddr(nodehash, owner);

        // Now give it to the new owner
        _ens.setOwner(nodehash, owner);

        // Stir in the random value to the generator (does keccak reduce our strength?)
//        _randomValues.push(keccak256(abi.encode(randomValue, _randomValues[_randomValues.length - 1])));

        emit Registered(label, owner);
    }

    function expires(bytes32 nodehash) public view returns (uint64) {
        return _takoyaki[nodehash].expires;
    }

    function randomIndex(bytes32 nodehash) public view returns (uint64) {
        return _takoyaki[nodehash].randomIndex;
    }

    function getHeight() public view returns (uint48) {
        return uint48(_randomValues.length);
    }

    function getRandomValueAtHeight(uint48 height) public view returns (bytes32) {
        return _randomValues[height];
    }

    function transfer(bytes32 labelHash, address newOwner) public {
        Takoyaki storage takoyaki = _takoyaki[labelHash];
        require(msg.sender == takoyaki.owner);
        require(takoyaki.expires > now);
        takoyaki.owner = newOwner;
        _ens.setSubnodeOwner(_nodehash, labelHash, newOwner);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        Takoyaki memory takoyaki = _takoyaki[bytes32(tokenId)];
        require(takoyaki.expires > now);
        return takoyaki.owner;
    }

    /**
     * Reclaim ownership of a name in ENS
     */
    /*
    function reclaim(uint256 tokenId, address owner) external {
        require(_ens.owner(_nodehash) == address(this));
        require(msg.sender == _admin);
        _ens.setSubnodeOwner(_nodehash, bytes32(tokenId), owner);
    }
    */
}
