#!/bin/bash

# Create the flattened CSS
python -c "import base64; spinner = base64.b64encode(file('./spinner.gif').read()); print file('./style.css').read().replace('./spinner.gif', 'data:image/gif;base64,' + spinner)" > ./dist/style.css

# Copy minified scripts
cp ./node_modules/ethers/dist/ethers.min.js ./dist/ethers.js
cp ./lib/dist/takoyaki.min.js ./dist/takoyaki.js
npx uglifyjs ./script.js --output ./dist/script.js

# Copy HTML and modify it to point external files to https://takoyaki.cafe/ (better caching)
cp ./index.html ./dist/index.html
sed -E -e 's/data:prod="-" ([a-z]+)="([^"]+)\//\1="https:\/\/takoyaki.cafe\//g' -i .tmp ./dist/index.html
rm ./dist/index.html.tmp
