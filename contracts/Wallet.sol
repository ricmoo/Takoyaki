pragma solidity ^0.5.9;

contract Wallet {
   uint public count;

   function onERC721Received(address from, address to, uint256 tokenId, bytes memory _data) public returns (bytes4) {
      count++;
      return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
   }
}
