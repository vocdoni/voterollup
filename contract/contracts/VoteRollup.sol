//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Verifier as RollupVerifier } from "../circuits/release/rollup.sol";
import { Verifier as SMTKeyExistsVerifier } from "../circuits/release/smtkeyexists.sol";
import { TokenStorageProof } from "./lib.sol";
import { Registry } from "./Registry.sol";

contract VoteRollup {
  uint256 constant _RFIELD =              21888242871839275222246405745257275088548364400416034343698204186575808495617;
  bytes32 public constant SLASHED_ROOT =  0x000000000000000000000000000000000000000000000000000000000000dead;

  struct Voting {
  	bytes32  nullifierRoot;
  	uint256  result;   
  }

  enum SlashReason {
  	NOT_REGISTERED,
  	ZERO_BALANCE
  }

  event Voted(bytes32, uint256,uint256[]);  
  event Started(bytes32, address,uint256,uint256,bytes32);
  event Slashed(bytes32, SlashReason);
  
  TokenStorageProof storageProof;
  Registry public registry;
  RollupVerifier rollupVerifier;
  SMTKeyExistsVerifier smtKeyExistsVerifier;

  mapping(bytes32 => Voting) public votings;
  
  constructor(address _registry) public {
     storageProof = new TokenStorageProof();
     rollupVerifier = new RollupVerifier();
     smtKeyExistsVerifier = new SMTKeyExistsVerifier();
     registry = Registry(_registry);
  }

  function start(address _tokenAddress, uint256 _balanceMappingPosition) external {
     uint256 blockNumber = block.number - 1;
     bytes32 blockHash = blockhash(blockNumber);
     bytes32 id = _votingIdOf(_tokenAddress, _balanceMappingPosition, blockNumber, blockHash); 
     emit Started(id, _tokenAddress, _balanceMappingPosition, blockNumber, blockHash);
  }

  // the collect function aggregates results and ensures that the bbj public key is valid 
  function collect(bytes32 id, bytes32 _nullifierRoot, uint256 _result, uint256 _count, uint256[] calldata _voters,
	uint[2] calldata _proofA, uint[2][2] calldata _proofB, uint[2] calldata _proofC) external {
     
      // verify proof, allow bypass for tests
      bytes memory packed = abi.encodePacked(votings[id].nullifierRoot,_nullifierRoot,_result,_count,id,_voters);
      uint[1] memory inputValues = [ uint256(sha256(packed)) % _RFIELD ];
      require(rollupVerifier.verifyProof(_proofA, _proofB, _proofC, inputValues), "invalid-proof");

      // accumulate result 
      votings[id].result += _result;
      votings[id].nullifierRoot = _nullifierRoot;

      emit Voted(id, _count, _voters); // other alternatives is just to scan all txs, or just emit VotedInBlock(blockno) to reduce costs 
  }

  function _votingIdOf(address _tokenAddress, uint256 _balanceMappingPosition, uint256 _blockNumber, bytes32 _blockHash) public pure returns ( bytes32){
  	bytes32 id = keccak256(abi.encodePacked(_tokenAddress, _balanceMappingPosition, _blockNumber, _blockHash));
	return bytes32(uint256(id) % _RFIELD);
  }

  struct ChallangeInput {
	address _tokenAddress;
	uint256 _balanceMappingPosition;
	uint256 _blockNumber;
	bytes32 _blockHash;

	uint256 _bbjPbkX;
	bytes   _blockHeaderRLP;
	
	bytes   _bbjAccountStateProof;
	bytes   _bbjStorageProof;

	bytes   _balanceAccountStateProof;
	bytes   _balanceStorageProof;
	uint[2] _proofA;
	uint[2][2] _proofB;
	uint[2] _proofC;
  }

  function challange(ChallangeInput calldata ci) external {
     	bytes32 id = _votingIdOf(ci._tokenAddress, ci._balanceMappingPosition, ci._blockNumber, ci._blockHash); 

	// check that the header is valid
	require(keccak256(ci._blockHeaderRLP) == ci._blockHash);

	// check if bbj voted
        uint[2] memory inputValues = [ uint(votings[id].nullifierRoot) , uint(ci._bbjPbkX) ];
	require(smtKeyExistsVerifier.verifyProof(ci._proofA, ci._proofB, ci._proofC, inputValues), "bbj-not-in-tree");

	// get the voter
        address voter = address(storageProof.getValueOf(
		ci._bbjPbkX, 
		address(registry), 
		1,
		ci._blockHeaderRLP, 
		ci._bbjAccountStateProof, 
		ci._bbjStorageProof
	));

	SlashReason reason;
	if (voter == address(0) ) {
		// not registered?, slash!	
		reason = SlashReason.NOT_REGISTERED;
	} else {
		// registered, but zero balance? slash!  

		// check that the voter do not have any token
	        uint256 balance = storageProof.getERC20Balance(
			voter, 
			ci._tokenAddress, 
			ci._balanceMappingPosition,
			ci._blockHeaderRLP, 
			ci._balanceAccountStateProof, 
			ci._balanceStorageProof
		);
		require(balance == 0);
		reason = SlashReason.ZERO_BALANCE;
	
	}
	slash(id,reason);
 }

  function slash(bytes32 _id, SlashReason challangeResason) internal {
	votings[_id].nullifierRoot = SLASHED_ROOT;
        emit Slashed(_id, challangeResason);
  }

}
