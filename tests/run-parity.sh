DIR="/tmp/test-parity-$(date +%Y-%m-%d_%H-%M-%S)"
echo "Running Parity in ${DIR}..."
mkdir "${DIR}"
mkdir "${DIR}/keys"

cp -r ./parity-keys "${DIR}/keys/DevelopmentChain"

parity --chain ./parity-dev.json \
       --unlock=0x7454a8F5a7c7555d79B172C89D20E1f4e4CC226C --password ./parity-dev.pwds \
       --gasprice 1000000000 \
       -d "${DIR}"
