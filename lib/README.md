Takoyaki NFT
============

Welcome to the Takoyaki NFT library.

The goal of this library is to simplify interacting with the
Takoyaki NFTs (Non-Fungible Tokens) on the Ethereum blockchain.

It contains the art asset rendering and trait computation functions
needed to create client side SVG files for a given set of traits
as well as the algorithms required to compute the traits from the
on-chain data for a given Takoyaki.

Installing
----------

```
/home/ricmoo/my-project> npm install --save takoyaki
```

```javascript
const Takoyaki = require("takoyaki");
```

API
---

### Rendering and Display Logic

**Takoyaki.getSvg ( traits [ , backgroundColor ] )** => *string*

Create an SVG string for the appearance `traits` and optionally a
`backgroundColor` (100% transparent, by default).

**Takoyaki.getLabelColor ( label [ , saturation = 90 [ , luminence = 90 ] ] )** => *string*

Create an `hsl(hue, saturation, luminence)` color for the given label, which can be
used for the background (sat = 90, lum = 90), or adding lighter/darker features,
such as borders or text.

**Takoyaki.SVG** => *string*

The raw SVG that is processed to generate individual Takoyaki.


### Traits

**Takoyaki.getTraits ( [ genes ] )** => *Traits*

Compute the traits for a given set of genes, which should include a `salt` and
`seeds`, which is an Array of up to 5 bytes6. If genes is omitted, a random set
of traits is returned.


### URLs and Labels

**Takoyaki.urlToLabel ( hostname )** => *string*

Converts a hostname into the label, accounting for [Punycode](https://en.wikipedia.org/wiki/Punycode),
so international and emoji names can be used.

**Takoyaki.labelToUrl ( label )** => *string*

Converts a label into the Punycode hostname.

**Takoyaki.nomarlizeLabel ( label )** => *string*

Normalize a label string, folding cases, UTF-8 composition and UTF-8 canonical
representation as per punycode.


### Takoyaki Contract

**Takoyaki.connect ( providerOrProvider )** => *TakoyakiContract*

Return a Contract instance to interact with the blockchain values for Takoyaki
Tokens.

**contract.getTransactions ( label , owner , salt [ , prefundRevealer ] )** => *Object*

Returns an object with two transaction Objects, `commit` and `reveal`, which can be
signed and sent to the network to commit and reveal. You MUST have a delay of at least
4 blocks between commit and reveal, and no more than 5,760 blocks.

This is the recommended method of using this library.

**contract.getTraits ( tokenId [ , hints ] )** => *Promise:Traits*

Returns the traits for a given Takoyaki. The hints can be used to save network
calls and to indicate information which is not yet available, such as the `salt`
prior to the reveal.

**contract.tokenURI ( tokenId )** => *Promise:string*

Returns the URL of a JSON description of the token

**contract.totalSupply ( )** => *Promise:BigNumber*

Returns the total number of Takoyaki currently issued. This may be higher than
the actual number, since the total supply is only decremented for expired
Takoyaki Tokens when `destroy` is called them.

**contract.symbol** => *string*

Returns "TAKO"

**contract.name** => *string*

Returns "Takoyaki"

**contract.fee ( )** => *Promise:BigNumber*

Returns the fee for a Takoyaki.

**contract.isValidLabel ( label )** => *boolean*

Returns true if and only if the label is valid.

**contract.getTakoyaki ( tokenId )** => *Promise:Object*

TODO

**contract.commit ( blindedCommit , prefundedRevealer , prefundAmount )** => *Promise:TransactionResponse*

TODO

**contract.cancelCommit ( blindedCommit )** => *TransactionResponse*

TODO

**contract.reveal ( label , owner , salt )** => *TransactionResponse*

TODO

**contract.renew ( tokenId )** => *TransactionResponse*

TODO

**contract.reclaim ( tokenId , owner )** => *TransactionResponse*

TODO

**contract.destroy ( tokenId )** => *TransactionResponse*

TODO

**contract.available ( tokenId )** => *Promise:boolean*

TODO

**contract.getTakoyaki ( tokenId )** => *Promise:Object*

TODO

**contract.ownerOf ( tokenId )** => *Promise:string*

Returns the owner the *tokenId* Takoyaki.

**contract.balanceOf ( address )** => *Promise:BigNumber*

Returns the number of Takoyaki tokens that *address* owns.

**contract.approve ( toAddress , tokenId )** => *Promise:TransactionResponse*

TODO

**contract.getApproved ( tokenId )** => *Promise:string*

TODO

**contract.setApprovedForAll ( toAddress , isApproved )** => *Promise:TransactionResponse*

TODO

**contract.isApprovedForAll ( owner , operator )** => *Promise:boolean*

TODO

**contract.transferFrom ( fromAddress , toAddress, tokenId )** => *Promise:TransactionResponse*

TODO

**contract.safeTransferFrom ( fromAddress , toAddress , tokenId , data )** => *Promise:TransactionResponse*

TODO



License
-------

All code is provided under the [MIT license](https://opensource.org/licenses/MIT) and all artwork is provided
under the [Creative Commons cc-by 4.0](https://creativecommons.org/licenses/by/4.0/)
license.

