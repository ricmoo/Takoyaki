#!/usr/bin/env node

'use strict';

const { inherits } = require('util');
const { ethers } = require('ethers');
const { CLI, dump, Plugin } = require('@ethersproject/cli/cli');

const MIN_REGISTRATION_DURATION_IN_DAYS = 28;
const PERMANENT_REGISTRAR_ID = '0x018fac06';
const REGISTER_TIMEOUT = 70000;
const INVALID_ADDRESS = '0x0000000000000000000000000000000000000000';

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

const cli = new CLI();

function RegisterPlugin() {}
inherits(RegisterPlugin, Plugin);

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
cli.run(process.argv.slice(2)).catch(err => {
  this.throwError(err);
});
