Metadata Service
================

The Metadata Service provides a simple Heroku backend to to
compliment the `tokenURI` contract call, returning a JSON
description of a given NFT, and generating SVG and PNG images
for each token.


Endpoints
---------

**[https://takoyaki.nftmd.com/json/TOKEN_ID](https://takoyaki.nftmd.com/json/b05e424817fb90aa7a79e9da5c5f94070a316219c6ebb863a9ff7ca357dc9fa9/)**

Generates the JSON description of the *TOKEN_ID* Takoyaki Token.


**[https://takoyaki.nftmd.com/svg/ENCODED_TRAITS](https://takoyaki.nftmd.com/svg/1_7269636d6f6f_670f0aec6d79467f07bfdc7fe6a934b807692e85f13ee6b7bc6da69b7188f23e_6b6b4fb95221_7265b22d098e_aa698013d271_82422dcd5539_394b95c369ec/)**

Generates the SVG of the Takoyaki Token with the *ENCODED_TRAITS*. See below
for the encoding. The string `random` may be used to generate a random
Takoyaki image.


**[https://takoyaki.nftmd.com/png/ENCODED_TRAITS?size=:SIZE](https://takoyaki.nftmd.com/png/1_7269636d6f6f_670f0aec6d79467f07bfdc7fe6a934b807692e85f13ee6b7bc6da69b7188f23e_6b6b4fb95221_7265b22d098e_aa698013d271_82422dcd5539_394b95c369ec/)**

Rasterizes the above SVG into a PNG for a Takoyaki Token with the
*ENCODED_TRAITS* as a *SIZE* x *SIZE* pixel PNG. The string `random`
may be used to generate a random Takoyaki image.

If the size query parameter is ommitted, a default size of 256
will be used. The maximum size is 1024x1024 pixels.


Encoding Traits
---------------

The traits are an underscore (i.e. `_`) delimited set of
hex strings. The fields are:

- **version:** which currently only supports `1`, which indicates the following fields:
- **name:** which is the hex encoded UTF-8 string label
- **salt:** which is the 32 byte (64 nibble) salt used during commit
- **seed0** through **seed4:** each of these 5 seeds is a 6 byte (12 nibble) seed based on the block hashes following certain blocks after the commit and reveal

Future versions will allow different parameters.


Managing
--------

**Testing**

To run locally and test new updates, from **this** directory, run:

```
/home/ricmoo/takoyaki/metadata-service> npm run local
```

**Production**

All code must be checked in, as Heroku uses git to manage deployments. To
deploy the service to Heroku, from the repositories **root** folder, run:

```
/home/ricmoo/takoyaki> npm run deploy-metadata-service
```

**Setup**

The first time used, you must set up Herkou. If you are deploying this
you will need to update the package.json to reflect a Heroku host you
own.

```
/home/ricmoo/takoyaki> npm run setup-heroku
```


License
-------

MIT License
