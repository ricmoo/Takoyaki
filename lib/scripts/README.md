takoyaki.eth: Scripts
=====================

Simple scripts needed for development and building.


generate.js
-----------

The `generate.js` script loads and parses the **master SVG** file
and dumps it as a JavaScript variable so that the main library
can simply `require("./asset.js")` it.

Currently the space saved is less than the zlib library requires,
but as new features are added to the **master SVG**, it may begin
to make sense to compress it.

This script is executed as part of the `npm run dist` target in
the [NPM library folder](../).


License
-------

MIT License.
