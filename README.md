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


Contract
--------

The contract is deployed on Ropsten and will soon be deployed to Mainnet.

See: [Takoyaki Contract](https://github.com/ricmoo/Takoyaki/tree/master/contracts)


API
---

The API allows anyone to easily interact with the Registrar and ERC-721 token
contract on the Ethereum network, as well as generate the traits from on-chain
data and finally render (entirely on the client side) a give Takoyaki for a
given set of traits.

See: [Takoyaki NPM Library](https://github.com/ricmoo/Takoyaki/tree/master/lib)


Metadata Service
----------------

The Metadata service is designed to be run on Heroku, and can be run locally
or deployed to your own Heroku instance.

See: [Takoyaki Metadata Service](https://github.com/ricmoo/Takoyaki/tree/master/metadata-service)


Command Line Interface
----------------------

This is still under constructions...

```
/home/ricmoo> takoyaki --help

Usage:
    takoyaki commit LABEL [ --salt SALT ] [ --owner ADDRESS ]
    takoyaki reveal LABEL [ --salt SALT ] [ --owner ADDRESS ]
```


License
-------

All code is released under the MIT license and all artwork under the
Creative Commons CC-BY-4.0 license.
