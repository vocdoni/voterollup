//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;

import { Verifier } from "../circuits/release/verifier.sol";
import { StorageProof } from "./lib.sol";

contract VoteRollup is Verifier {
  bytes32 public nullifierRoot;
  uint256 public result;   
  uint256 public count;

  event Challanged();
	
  using StorageProof for StorageProof;

  mapping(address=>bytes32) keys;

  function registerVoter(bytes32 bbjPbkX) external {
  	keys[msg.sender] = bbjPbkX;
  }

  // note that _voters should be *exactly* the batch size
  function collect(bytes32 _nullifierRoot, uint256 _result, uint256 _count, bytes32[] calldata _voters,
		   uint[2] calldata _proofA, uint[2][2] calldata _proofB, uint[2] calldata _proofC) external {
  	
      uint[1] memory inputValues;
      inputValues[0] = uint(sha256(abi.encodePacked(nullifierRoot, _nullifierRoot, _result, _count, _voters)));
      require(verifyProof(_proofA, _proofB, _proofC, inputValues), "invalid-proof");

      result += _result;
      count += _count;
      nullifierRoot = _nullifierRoot;
  }
 
  function challange_not_in_census(
  	// ERC20 proof
	address _voter,
	address _tokenAddress,
	uint256 _balanceMappingPosition,
	uint256 _blockNumber,
	bytes   calldata _blockHeaderRLP,
	bytes   calldata _accountStateProof,
	bytes   calldata _storageProof,

	// Nullifiers proof
	uint[8] calldata _proofABC
  ) external {
	// check that the voter do not have any token
	uint256 balance = StorageProof.getERC20Balance(_voter, _tokenAddress, _balanceMappingPosition,
	   _blockNumber, _blockHeaderRLP, _accountStateProof, _storageProof);
	require(balance == 0);

	// check that the voter registered the key
        bytes32 bbjPbkX = keys[_voter];
	require(bbjPbkX != 0);

	// check that the voter exists in the nullifiers
	// require(verifierProof2(bbkPbkX, nullifierRoot, _proofA, _proofB, _proofC); 
  
        emit Challanged();
  }
}


