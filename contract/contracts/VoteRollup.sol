//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "../circuits/release/verifier.sol";

contract VoteRollup is Verifier {
  bytes32 public nullifierRoot;
  uint256 public result;   
  uint256 public count;

  function collect(bytes32 _nullifierRoot, uint256 _result, uint256 _count, bytes32[] calldata _voters,
		   uint[2] calldata _proofA, uint[2][2] calldata _proofB, uint[2] calldata _proofC) external {
  	
      uint[1] memory inputValues;
      inputValues[0] = uint(sha256(abi.encodePacked(nullifierRoot, _nullifierRoot, _result, _count, _voters)));
      require(verifyProof(_proofA, _proofB, _proofC, inputValues), "invalid-proof");

      result += _result;
      count += _count;
      nullifierRoot = _nullifierRoot;
  }

}
