Takoyaki NFT
============

Welcome to the Takoyaki NFT library.

The goal of this library is to simplify interacting with the
Takoyaki NFTs (Non-Fungible Tokens) on the Ethereum blockchain.

It contains the art asset rendering an trait computation functions
needed to create client side SVG files for a given set of traits
as well as the algorithms required to compute the traits from the
on-chain data for a given Takoyaki.


API
---

**getSvg ( state, traits [ , backgroundColor ] )**

Create an SVG string for the given hatch `state`, appearance `traits`
and optionally a `backgroundColor` (100% transparent, by default).

The `state` should be a value between 0 and 5. TODO: This will likely
be rolled into traits.

**getTraits ( provider, tokenId )**

Look up the traits for a given `tokenId` on the network provided by `provider`.


License
-------

All code is provided under the [MIT license](https://opensource.org/licenses/MIT) and all artwork is provided
under the [Creative Commons cc-by 4.0](https://creativecommons.org/licenses/by/4.0/)
license.

