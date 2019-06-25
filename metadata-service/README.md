Metadata Service
================

The Metadata Service provides a simple Heroku backend to to
compliment the `tokenURI` contract call, returning a JSON
description of a given NFT, and generating SVG and PNG images
for each token.


Endpoints
---------

**https://takoyaki.nftmd.com/json/TOKEN_ID**

Generates the JSON description of the *TOKEN_ID* Takoyaki Token.


**https://takoyaki.nftmd.com/svg/TOKEN_ID**

Generates the SVG of the *TOKEN_ID* Takoyaki Token. The *TOKEN_ID* should
be either a 64 nibble hex string (**no** `0x` prefix), or the string `random`
to generate a random image.


**https://takoyaki.nftmd.com/png/:TOKEN_ID?size=:SIZE**

Generates the image of the *TOKEN_ID* Takoyaki Token, as a *SIZE* x *SIZE*
pixel PNG. The *TOKEN_ID* should be either a 64 nibble hex string (**no**
`0x` prefix), or the string `random` to generate a random image.

If the size query parameter is ommitted, a default size of 256
will be used. The maximum size is 1024x1024 pixels.


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


License
-------

MIT License
