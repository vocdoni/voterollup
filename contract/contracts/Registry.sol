//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.11;
contract Registry {
  mapping(address=>uint256) public addr2bbj;
  mapping(uint256=>address) public bbj2addr;

  function register(uint256 bbjPbkX) external {
  	// clean last key
        bbj2addr[addr2bbj[msg.sender]]=address(0);
        addr2bbj[msg.sender] = bbjPbkX;
        require(bbj2addr[bbjPbkX]==address(0), "key-already-assigned");
  	bbj2addr[bbjPbkX]=msg.sender; 
  }
}
