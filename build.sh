#!/bin/bash

# Create the flattened CSS
python -c "import base64; spinner = base64.b64encode(file('./static/spinner.gif').read()); print file('./static/style.css').read().replace('./spinner.gif', 'data:image/gif;base64,' + spinner)" > ./heroku-app/static/style.css
python -c "import base64; background = base64.b64encode(file('./static/background.jpg').read()); print file('./static/style-mobile.css').read().replace('./background.jpg', 'data:image/jpeg;base64,' + background)" > ./heroku-app/static/style-mobile.css

# Copy minified scripts
cp ./lib/node_modules/ethers/dist/ethers.umd.min.js ./heroku-app/static/
cp ./lib/dist/takoyaki.umd.min.js ./heroku-app/static/
npx terser ./static/script.js --output ./heroku-app/static/script.js

# Copy HTML and other static files
cp ./index.html ./static/favicon.ico ./static/history.js ./static/logo-metamask.svg ./heroku-app/static/

# Prepare a copy for the fallback edge cache servers, which is served in
# the event the Heroku app is down. The only difference with serving from
# the edge cache is that OpenGraph will not be populated.
cp ./heroku-app/static/* ./heroku-app/static-fallback/
sed -E -e 's/data:prod="-" ([a-z]+)="([^"]+)\//\1="https:\/\/takoyaki.cafe\//g' -i .tmp ./heroku-app/static-fallback/index.html
rm ./heroku-app/static-fallback/index.html.tmp
