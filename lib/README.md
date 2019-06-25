Takoyaki NFT
============

Welcome to the Takoyaki NFT library.

The goal of this library is to simplify interacting with the
Takoyaki NFTs (Non-Fungible Tokens) on the Ethereum blockchain.

It contains the art asset rendering and trait computation functions
needed to create client side SVG files for a given set of traits
as well as the algorithms required to compute the traits from the
on-chain data for a given Takoyaki.


API
---

### Rendering and Display Logic

**getSvg ( traits [ , backgroundColor ] )** *=> string*

Create an SVG string for the appearance `traits` and optionally a
`backgroundColor` (100% transparent, by default).

**getLabelColor ( label [ , saturation [ , luminence ] ] )** *=> string*

Create an `hsl(hue, saturation, luminence)` color for the given label.


### Traits

**getTraits ( provider, tokenId )** *=> Traits*

Look up the traits for a given `tokenId` on the network provided by `provider`.

**randomTraits ( )** *=> Traits*

Create a random set of traits, with the state set to 5 (fully revealed)


### Connecting to the Blockchain

**connect ( providerOrProvider )** *=> TakoyakiContract*

Return a Contract instance to interact with the blockchain values for Takoyaki
Tokens.


### Configuration

Most of thse are not necessary, but may be useful to introspect the current
configuration of the Takoyaki Registrar Contract on this chain.

**TakoyakiContract.prototype.admin ( )**
**TakoyakiContract.prototype.ens ( )**
**TakoyakiContract.prototype.nodehash ( )**
**TakoyakiContract.prototype.defaultResolver ( )**


### Token Information

**TakoyakiContract.prototype.tokenURI ( tokenId )** *=> Promise<string>*

Returns the URL of a JSON description of the token

**TakoyakiContract.prototype.totalSupply ( )**

Returns the total number of Takoyaki currently issued. This may be higher than
the actual number, since the total supply is only decremented for expired
Takoyaki Tokens when `destroy` is called them.

**TakoyakiContract.prototype.symbol ( )**

Returns "TAKO"

**TakoyakiContract.prototype.name ( )**

Returns "Takoyaki"

**TakoyakiContract.prototype.fee ( )** *=> BigNumber*

TODO

**TakoyakiContract.prototype.isValidLabel ( label )** *=> boolean*

TODO

**TakoyakiContract.prototype.commit ( blindedCommit , prefundedRevealer , prefundAmount )** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.cancelCommit ( blindedCommit ** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.reveal ( label , owner , salt )** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.renew ( tokenId )** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.reclaim ( tokenId , owner )** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.destroy ( tokenId )** *=> TransactionResponse*

TODO

**TakoyakiContract.prototype.available ( tokenId )** *=> Promise<boolean>*

TODO

**TakoyakiContract.prototype.expires ( tokenId )** *=> Promise<number>*

TODO

**TakoyakiContract.prototype.getTraits ( tokenId )** *=> Promise<Traits>*

TODO

**TakoyakiContract.prototype.ownerOf ( tokenId )** *=> Promise<string>*

TODO

**TakoyakiContract.prototype.balanceOf ( address )** *=> Promise<BigNumber>*

TODO

**TakoyakiContract.prototype.approve ( toAddress , tokenId )** *=> Promise<TransactionResponse>*

TODO

**TakoyakiContract.prototype.getApproved ( tokenId )** *=> Promise<string>*

TODO

**TakoyakiContract.prototype.setApprovedForAll ( toAddress , isApproved )** *=> Promise<TransactionResponse>*

TODO

**TakoyakiContract.prototype.isApprovedForAll ( owner , operator )** *=> Promise<boolean>*

TODO

**TakoyakiContract.prototype.transferFrom ( fromAddress , toAddress, tokenId )** *=> Promise<TransactionResponse>*

TODO

**TakoyakiContract.prototype.safeTransferFrom ( fromAddress , toAddress , tokenId , data )** *=> Promise<TransactionResponse>*

TODO


License
-------

All code is provided under the [MIT license](https://opensource.org/licenses/MIT) and all artwork is provided
under the [Creative Commons cc-by 4.0](https://creativecommons.org/licenses/by/4.0/)
license.

