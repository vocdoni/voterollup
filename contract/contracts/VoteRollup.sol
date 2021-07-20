//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Verifier as RollupVerifier } from "../circuits/release/rollup.sol";
import { Verifier as SMTKeyExistsVerifier } from "../circuits/release/smtkeyexists.sol";
import { StorageProof } from "./lib.sol";

contract VoteRollup {
  bytes32 public nullifierRoot;
  uint256 public result;   
  uint256 public count;
  address tokenAddress;
  uint256 balanceMappingPosition;
  uint256 blockNumber;

  // Modulus zkSNARK
  uint256 constant _RFIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  event Voted(address[]);  
  event Challanged();
  
  StorageProof storageProof;
  RollupVerifier rollupVerifier;
  SMTKeyExistsVerifier smtKeyExistsVerifier;
  
  mapping(address=>bytes32) public keys;

  constructor(address _tokenAddress, uint256 _balanceMappingPosition, uint256 _blockNumber) public {
     storageProof = new StorageProof();
     rollupVerifier = new RollupVerifier();
     smtKeyExistsVerifier = new SMTKeyExistsVerifier();
     tokenAddress = _tokenAddress;
     balanceMappingPosition = _balanceMappingPosition;
     blockNumber = _blockNumber;
  }

  function registerVoter(bytes32 bbjPbkX) external {
  	keys[msg.sender] = bbjPbkX;
  }
  
  function collect(bytes32 _nullifierRoot, uint256 _result, uint256 _count, address[] calldata _voters,
		   uint[2] calldata _proofA, uint[2][2] calldata _proofB, uint[2] calldata _proofC) external {
     
      // verify proof, allow bypass for tests
      if (_proofA[0] != 0) {
	  bytes32[] memory voters = new bytes32[](_voters.length);
	  for (uint256 n =0;n<_count; n++) { 
		voters[n] = keys[_voters[n]];
		require(voters[n]!=0, "voter not in census");
	  }
          bytes memory packed = abi.encodePacked(nullifierRoot,_nullifierRoot,_result,_count,voters);
	  uint[1] memory inputValues = [ uint256(sha256(packed)) % _RFIELD ];
          require(rollupVerifier.verifyProof(_proofA, _proofB, _proofC, inputValues), "invalid-proof");
      }

      // accumulate result 
      result += _result;
      count += _count;
      nullifierRoot = _nullifierRoot;

      emit Voted(_voters); // other alternatives is just to scan all txs, or just emit VotedInBlock(blockno) to reduce costs 
  }

  function challange(
	address _voter,

	bytes   memory _blockHeaderRLP,
	bytes   memory _accountStateProof,
	bytes   memory _storageProof,

	uint[2] memory _proofA,
	uint[2][2] memory _proofB,
	uint[2] memory _proofC
  ) external {
	// check that the voter registered the key
        bytes32 bbjPbkX = keys[_voter];
	require(bbjPbkX != 0);

	// check that the voter do not have any token
	uint256 balance = storageProof.getERC20Balance(
		_voter, 
		tokenAddress, 
		balanceMappingPosition,
	   	blockNumber,
		_blockHeaderRLP, 
		_accountStateProof, 
		_storageProof
	);
	
	require(balance == 0);

	// check that the voter exists in the nullifiers
        uint[2] memory inputValues = [ uint(nullifierRoot) , uint(bbjPbkX) ];
	require(smtKeyExistsVerifier.verifyProof(_proofA, _proofB, _proofC, inputValues)); 
  
        emit Challanged();
  }
}
