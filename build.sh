#!/bin/bash

# Create the flattened CSS
python -c "import base64; spinner = base64.b64encode(file('./spinner.gif').read()); print file('./style.css').read().replace('./spinner.gif', 'data:image/gif;base64,' + spinner)" > ./heroku-app/static/style.css
python -c "import base64; background = base64.b64encode(file('./background.jpg').read()); print file('./style-mobile.css').read().replace('./background.jpg', 'data:image/jpeg;base64,' + background)" > ./heroku-app/static/style-mobile.css

# Copy minified scripts
cp ./node_modules/ethers/dist/ethers.min.js ./heroku-app/static/ethers.js
cp ./lib/dist/takoyaki.min.js ./heroku-app/static/takoyaki.js
npx uglifyjs ./script.js --output ./heroku-app/static/script.js

# Copy HTML and modify it to point external files to https://takoyaki.cafe/ (better caching)
cp ./index.html ./heroku-app/static/index.html
#sed -E -e 's/data:prod="-" ([a-z]+)="([^"]+)\//\1="https:\/\/takoyaki.cafe\//g' -i .tmp ./heroku-app/static/index.html
#rm ./heroku-app/static/index.html.tmp

cp ./history.js ./heroku-app/static/history.js

