'use strict';

const ethers = require('ethers');
const Takoyaki = require('../lib/lib');

const getEvent = (contract, receipt, eventName) =>
  receipt.logs
    .map(log => contract.interface.parseLog(log))
    .filter(Boolean)
    .find(({ name }) => name === eventName);

const register = async (provider, signer, label) => {
  const takoyaki = Takoyaki.connect(signer);
  const salt = ethers.utils.keccak256(ethers.utils.randomBytes(32));

  const fee = await takoyaki.fee(label);
  const options = { value: fee };

  const blindedCommit = await takoyaki.makeBlindedCommitment(label, signer.address, salt);

  let tx = await takoyaki.commit(
    blindedCommit,
    ethers.constants.AddressZero,
    0,
    options
  );
  let receipt = await tx.wait();

  await provider.mineBlocks(5);

  tx = await takoyaki.reveal(label, signer.address, salt);
  return tx.wait();
};

const getTokenId = (contract, receipt) => {
  const transferEvent = getEvent(contract, receipt, 'Transfer');

  if (!transferEvent) {
    throw new Error('Missing transfer event');
  }

  if (transferEvent.values.length !== 3) {
    throw new Error(
      `Expect 3 parameters for the transfer event, but got ${
        transferEvent.values.length
      }`
    );
  }

  const tokenId = transferEvent.values[2];
  return tokenId;
};

const safeTransfer = async (signer, owner, newOwner, tokenId, data) => {
  const abi = data
    ? [ "function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public @150000" ]
    : [ "function safeTransferFrom(address from, address to, uint256 tokenId) public @150000"];

  let contract = new ethers.Contract("takoyaki.eth", abi, signer);

  const tx = data
    ? await contract.safeTransferFrom(owner.address, newOwner.address, tokenId, data)
    : await contract.safeTransferFrom(owner.address, newOwner.address, tokenId);

  const receipt = await tx.wait();
  return receipt;
};

const submitBlindedCommit = async (provider, signer, label) => {
  const salt = ethers.utils.keccak256(ethers.utils.randomBytes(32));

  const takoyaki = Takoyaki.connect(signer);
  const fee = await takoyaki.fee(label);
  const options = { value: fee };

  const blindedCommit = await takoyaki.makeBlindedCommitment(label, signer.address, salt);
  let tx = await takoyaki.commit(
    blindedCommit,
    ethers.constants.AddressZero,
    0,
    options
  );

  const receipt = await tx.wait();
  await provider.mineBlocks(5);

  const commitEvent = getEvent(takoyaki, receipt, 'Committed');
  if (!commitEvent) {
    throw new Error('missing commit event');
  }

  if (commitEvent.values.length !== 2) {
    throw new Error(
      `Expect 2 parameters for the commit event, but got ${
        commitEvent.values.length
      }`
    );
  }

  if( blindedCommit !== commitEvent.values[1]) {
     throw new Error(`blindedCommit mismatch, expect ${blindedCommit} got ${commitEvent.values[1]}`);
  }

  return blindedCommit;
};

const syncUpkeepFee = async (admin, signer, tokenId) => {
    const takoyaki = Takoyaki.connect(signer);
    const smallerFee = await takoyaki.getTakoyaki(tokenId).then(token => token.upkeepFee.sub(1));

    const takoyakiAdmin = Takoyaki.connect(admin);
    const feeTx = await takoyakiAdmin.setFee(smallerFee);
    await feeTx.wait();

    const syncTx = await takoyaki.syncUpkeepFee(tokenId);
    await syncTx.wait();

    return smallerFee;
};

module.exports = {
  connect: Takoyaki.connect,
  getEvent,
  getTokenId,
  register,
  safeTransfer,
  submitBlindedCommit,
  syncUpkeepFee
};
