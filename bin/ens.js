#!/usr/bin/env node

'use strict';

const { inherits } = require('util');
const { ethers } = require('ethers');
const utils = ethers.utils;
const { CLI, dump, Plugin } = require('@ethersproject/cli/cli');
const fs = require('fs');
const { compile } = require('@ethersproject/cli/solc');

const MIN_REGISTRATION_DURATION_IN_DAYS = 28;
const PERMANENT_REGISTRAR_ID = '0x018fac06';
const REGISTER_TIMEOUT = 70000;
const INVALID_ADDRESS = '0x0000000000000000000000000000000000000000';

const TAKOYAKI_ADDRESS = '0x6C7c09740209c9c3EdcF65971D4616FFf0054621';

const ENS_ABI = [
  'function resolver(bytes32 nodehash) view returns (address addr)'
];

const RESOLVER_ABI = [
  'function  interfaceImplementer(bytes32 namehash, bytes4 interfaceID) view returns (address addr)'
];

const CONTROLLER_ABI = [
  'function register(string name, address owner, uint duration, bytes32 secret) external payable',
  'function commit(bytes32 commitment) public',
  'function rentPrice(string name, uint duration) view public returns(uint)',
  'function available(string name) view public returns(bool)',
  'function makeCommitment(string name, address owner, bytes32 secret) pure public returns(bytes32)'
];

const TAKOYAKI_ABI = [
  'function isValidLabel(string label) public view returns (bool)',
  'function reveal(string label, bytes32 randomValue, address owner) public',
  'function fee() public view returns (uint256)',
  'function commit(bytes32 txPreimage) public payable returns (address)'
];

const cli = new CLI();

function RegisterPlugin() {}
inherits(RegisterPlugin, Plugin);

function DeployPlugin() {}
inherits(DeployPlugin, Plugin);

function SimulatePlugin() {}
inherits(SimulatePlugin, Plugin);

DeployPlugin.getHelp = function() {
  return {
    name: 'deploy ENS_NAME',
    help: 'deploy the takoyaki contract for ENS_NAME'
  };
};

DeployPlugin.prototype.prepareArgs = async function(args) {
  await Plugin.prototype.prepareArgs.call(this, args);
  if (args.length !== 1) {
    this.throwUsageError('deploy requires ENS_NAME');
  }

  if (this.accounts.length !== 1) {
    this.throwError('deploy requires an account');
  }

  this.ensName = args[0];
};

DeployPlugin.prototype.run = async function(a) {
  await Plugin.prototype.run.call(this);
  let code = compile(
    fs.readFileSync('./contracts/TakoyakiRegistrar.sol').toString(),
    {
      optimize: true
    }
  ).filter(c => c.name === 'TakoyakiRegistrar')[0];

  let factory = new ethers.ContractFactory(
    code.interface,
    code.bytecode,
    this.accounts[0]
  );

  let network = await this.provider.getNetwork();
  let contract = await factory.deploy(
    network.ensAddress,
    ethers.utils.namehash(this.ensName),
    {
      gasLimit: 2000000
    }
  );

  let receipt = await contract.deployed();
  console.log(receipt);
};

SimulatePlugin.getHelp = function() {
  return {
    name: 'simulate ENS_NAME LABEL',
    help: 'simulate creating a subdomain LABEL every 15 seconds'
  };
};

SimulatePlugin.prototype.prepareArgs = async function(args) {
  await Plugin.prototype.prepareArgs.call(this, args);
  if (args.length !== 2) {
    this.throwUsageError('simulate requires ENS_NAME and LABEL');
  }

  if (this.accounts.length !== 1) {
    this.throwError('simulate requires an account');
  }

  this.ensName = args[0];
  this.label = args[1];
};

const runSimulator = (round, simulator) => {
  setTimeout(async () => {
    try {
      const gasPrice = await simulator.provider.getGasPrice();
      let randomValue = utils.hexlify(ethers.utils.randomBytes(32));
      let label = simulator.label + round;
      let revealTx = await simulator.registrar.populateTransaction.reveal(
        label,
        randomValue,
        simulator.owner
      );
      revealTx.nonce = 0;
      revealTx.chainId = simulator.chainId;
      revealTx.gasPrice = gasPrice.mul(11).div(10);
      revealTx.gasLimit = 250000;

      revealTx = await utils.resolveProperties(revealTx);

      let revealPreimage = utils.keccak256(
        utils.serializeTransaction(revealTx)
      );

      let commitTx = await simulator.registrar.commit(revealPreimage, {
        gasPrice: gasPrice,
        gasLimit: 500000,
        value: utils.parseEther('0.1')
      });

      let receipt = await commitTx.wait();
      let serializedReveal = utils.serializeTransaction(revealTx, {
        r: receipt.logs[0].data,
        s: '0x0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead0c70dead',
        recoveryParam: 0
      });

      let tx = await simulator.provider.sendTransaction(serializedReveal);
      //receipt = await simulator.provider.waitForTransaction(tx.hash);
      console.log('done:', label, tx);

      runSimulator(round + 1, simulator);
    } catch (err) {
      console.log(err);
    }
  }, simulator.timeout);
};

SimulatePlugin.prototype.run = async function(a) {
  await Plugin.prototype.run.call(this);

  this.timeout = 15000;
  this.chainId = await this.provider.getNetwork().then(n => n.chainId);
  this.owner = await this.accounts[0].getAddress();
  this.registrar = new ethers.Contract(
    TAKOYAKI_ADDRESS,
    TAKOYAKI_ABI,
    this.accounts[0]
  );
  runSimulator(1, this);
};

RegisterPlugin.getHelp = function() {
  return {
    name: 'register ENS_NAME DURATION',
    help: 'register the ENS name for DURATION in days'
  };
};

RegisterPlugin.getOptionHelp = function() {
  return [
    {
      name: '[ --owner ENS_OWNER_ADDRESS ]',
      help: 'ENS owner address'
    }
  ];
};

RegisterPlugin.prototype.prepareOptions = async function(argParser) {
  await Plugin.prototype.prepareOptions.call(this, argParser);
  this.ensOwner = argParser.consumeOption('owner');
};

RegisterPlugin.prototype.prepareArgs = async function(args) {
  await Plugin.prototype.prepareArgs.call(this, args);

  if (args.length !== 2) {
    this.throwUsageError('register requires ENS_NAME and DURATION');
  }

  this.ensName = args[0];
  this.ensNameHash = ethers.utils.namehash(this.ensName);
  this.durationInDays = Number(args[1]);

  if (!Number.isInteger(this.durationInDays)) {
    this.throwError('Duration must be an integer');
  }

  const domains = this.ensName.split('.');
  if (domains.length !== 2) {
    this.throwError('register only supports top level domain currently');
  }

  this.ensTLD = domains[1];
  this.ensLabel = domains[0];

  if (this.accounts.length !== 1) {
    this.throwError('register requires an account');
  }

  dump('ENS Name: ' + this.ensName, {});
  dump('ENS Name Hash: ' + this.ensNameHash, {});
  dump('duration(days): ' + this.durationInDays, {});

  if (this.durationInDays < MIN_REGISTRATION_DURATION_IN_DAYS) {
    this.throwError(
      `Duration must be greater than ${MIN_REGISTRATION_DURATION_IN_DAYS} days`
    );
  }

  this.duration = this.durationInDays * 24 * 3600;
  dump('duration: ' + this.duration, {});
};

const getRegistrarAddress = async (provider, name) => {
  const namehash = ethers.utils.namehash(name);
  const contract = new ethers.Contract(
    provider.network.ensAddress,
    ENS_ABI,
    provider
  );

  const resolverAddress = await contract.resolver(namehash);
  dump('resolver address: ' + resolverAddress, {});

  if (resolverAddress === INVALID_ADDRESS) {
    throw new Error(
      `The top level domain, ${name}, is not current supported by ENS`
    );
  }

  const Resolver = new ethers.Contract(resolverAddress, RESOLVER_ABI, provider);
  const registrarAddress = await Resolver.interfaceImplementer(
    namehash,
    PERMANENT_REGISTRAR_ID
  );

  dump('registrar address: ' + registrarAddress, {});
  return registrarAddress;
};

RegisterPlugin.prototype.run = async function(a) {
  await Plugin.prototype.run.call(this);

  dump('ENS address: ' + this.provider.network.ensAddress, {});

  const registrarAddress = await getRegistrarAddress(
    this.provider,
    this.ensTLD
  );

  if (registrarAddress === INVALID_ADDRESS) {
    this.throwError(`registrar address is invalid`);
  }

  const contract = new ethers.Contract(
    registrarAddress,
    CONTROLLER_ABI,
    this.accounts[0]
  );

  const available = await contract.available(this.ensLabel);
  if (!available) {
    this.throwError(`${this.ensName} is not available`);
  }

  const value = await contract.rentPrice(this.ensLabel, this.duration);
  const overrides = {
    gasLimit: 1000000,
    value
  };

  const owner = this.ensOwner
    ? this.ensOwner
    : await this.accounts[0].getAddress();
  dump('ens owner: ' + owner, {});

  const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  dump('secret: ' + secret, {});

  const commitment = await contract.makeCommitment(
    this.ensLabel,
    owner,
    secret
  );
  dump('commitment: ' + commitment, {});

  const tx = await contract.commit(commitment);
  await tx.wait();

  // wait for timeout before revealing/registering the ens name
  setTimeout(async () => {
    await contract.register(
      this.ensLabel,
      owner,
      this.duration,
      secret,
      overrides
    );
  }, REGISTER_TIMEOUT);
};

cli.addPlugin('register', RegisterPlugin);
cli.addPlugin('deploy', DeployPlugin);
cli.addPlugin('simulate', SimulatePlugin);

cli.run(process.argv.slice(2)).catch(err => {
  this.throwError(err);
});
