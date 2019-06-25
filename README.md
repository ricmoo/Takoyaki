takoyaki.eth
============

Each Takoyaki is a unique, cute ERC-721 Octopus token, which is also
an [ENS name](https://ens.domains). It is meant as a fun and easy way
to start your foray into ENS, which allows you to use a friendly name
for your Ethereum address, rather than a long string of hexidecimal
characters.


Takoyaki began was our [ETHNewYork](https://ethnewyork.com) hackathon project.

We've since spruced it up a bit and are releasing it. :)


Web Interface
-------------

By far, the easiest way to interact with Takoyaki, is using our website, https://takoyaki.cafe.



API
---

The API allows anyone to easily interact with the Registrar and ERC-721 token
contract on the Ethereum network, as well as generate the traits from on-chain
data and finally render (entirely on the client side) a give Takoyaki for a
given set of traits.

The JavaScript API can be installed using:

```
/home/ricmoo/my-project> npm install --save takoyaki
```

**Takoyaki.connect(providerOrSigner)**

TakoyakiContract.makeCommitment( label , owner , salt)
TakoyakiContract.commit( label , owner , salt)
TakoyakiContract.reveal( label , owner , salt)
TakoyakiContract.getTraits( label , owner , salt)

TakoyakiContract.fee()
TakoyakiContract.totalSupply()
TakoyakiContract.defaultResolver()
TakoyakiContract.admin()
TakoyakiContract.()

**Takoyaki.getTraits(label)**
**Takoyaki.getSvg(traits)**

Command Line Interface
----------------------

```
/home/ricmoo> takoyaki --help

Usage:
    takoyaki commit LABEL [ --salt SALT ] [ --owner ADDRESS ]
    takoyaki reveal LABEL [ --salt SALT ] [ --owner ADDRESS ]
```


Project Componets
-----------------

- The [NPM library](https://github.com/ricmoo/Takoyaki/tree/master/lib); all the needed JavaScript libraries for blockchain interaction and composing the asset SVG (client-side)
- The [Metadata Service](https://github.com/ricmoo/Takoyaki/tree/master/metadata-service); a Heroku app which returns JSON metadata, composed SVG and renders PNG images per Token
- The [Takoyaki.cafe website](https://github.com/ricmoo/Takoyaki/tree/master/website); the complete website frontend, as well as a packaged single-file [dist](https://github.com/ricmoo/Takoyaki/tree/master/dist) which is availble online at [Takoyaki.cafe](https://takoyaki.cafe)
- The [Command-Line Interface](https://github.com/ricmoo/Takoyaki/tree/master/bin); 
- The [Solidity Contract](https://github.com/ricmoo/Takoyaki/blob/master/contracts/TakoyakiRegistrar.sol); the ERC-721 and Registrar contract on-chain, deployed on [mainnet](https://etherscan.io) and [ropsten](https://ropsten.etherscan.io)


License
-------

All code is released under the MIT license and all artwork under the
Creative Commons CC-BY-4.0 license.
