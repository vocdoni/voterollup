//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;

import { Verifier as RollupVerifier } from "../circuits/release/rollup.sol";
import { Verifier as SMTKeyExistsVerifier } from "../circuits/release/smtkeyexists.sol";
import { TokenStorageProof } from "./lib.sol";
import { Registry } from "./Registry.sol";

contract VoteRollup {
  bytes32 public nullifierRoot;
  uint256 public result;   
  uint256 public count;
  address public tokenAddress;
  uint256 public balanceMappingPosition;
  bytes32 public blockHash;
  uint256 public blockNumber;
  bool    public challanged;
  Registry public registry;

  // Modulus zkSNARK
  uint256 constant _RFIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  enum SlashReason {
  	NOT_REGISTERED,
  	ZERO_BALANCE
  }

  event Voted(uint256,uint256[]);  
  event Slashed(SlashReason);
  
  TokenStorageProof storageProof;
  RollupVerifier rollupVerifier;
  SMTKeyExistsVerifier smtKeyExistsVerifier;
  
  constructor(address _registry, address _tokenAddress, uint256 _balanceMappingPosition) public {
     storageProof = new TokenStorageProof();
     rollupVerifier = new RollupVerifier();
     smtKeyExistsVerifier = new SMTKeyExistsVerifier();
     registry = Registry(_registry);

     tokenAddress = _tokenAddress;
     balanceMappingPosition = _balanceMappingPosition;
     blockNumber = block.number - 1 ;
     blockHash = blockhash(blockNumber);
  }

  function start(address _tokenAddress, uint256 _balanceMappingPosition) external {
     tokenAddress = _tokenAddress;
     balanceMappingPosition = _balanceMappingPosition;
     blockNumber = block.number - 1;
     blockHash = blockhash(blockNumber);
  }

  // the collect function aggregates results and ensures that the bbj public key is valid 
  function collect(bytes32 _nullifierRoot, uint256 _result, uint256 _count, uint256[] calldata _voters,
		   uint[2] calldata _proofA, uint[2][2] calldata _proofB, uint[2] calldata _proofC) external {
     
      // verify proof, allow bypass for tests
      bytes memory packed = abi.encodePacked(nullifierRoot,_nullifierRoot,_result,_count,_voters);
      uint[1] memory inputValues = [ uint256(sha256(packed)) % _RFIELD ];
      require(rollupVerifier.verifyProof(_proofA, _proofB, _proofC, inputValues), "invalid-proof");

      // accumulate result 
      result += _result;
      count += _count;
      nullifierRoot = _nullifierRoot;

      emit Voted(_count, _voters); // other alternatives is just to scan all txs, or just emit VotedInBlock(blockno) to reduce costs 
  }

  function challange(
	uint256 _bbjPbkX,
	bytes   memory _blockHeaderRLP,
	
	bytes   memory _bbjAccountStateProof,
	bytes   memory _bbjStorageProof,

	bytes   memory _balanceAccountStateProof,
	bytes   memory _balanceStorageProof,
	uint[2] memory _proofA,
	uint[2][2] memory _proofB,
	uint[2] memory _proofC
  ) external {
	// check that the header is valid
	require(keccak256(_blockHeaderRLP)==blockHash);

	// check if bbj voted
        uint[2] memory inputValues = [ uint(nullifierRoot) , uint(_bbjPbkX) ];
	require(smtKeyExistsVerifier.verifyProof(_proofA, _proofB, _proofC, inputValues), "bbj-not-in-tree");

	// get the voter
        address voter = address(storageProof.getValueOf(
		_bbjPbkX, 
		address(registry), 
		1,
		_blockHeaderRLP, 
		_bbjAccountStateProof, 
		_bbjStorageProof
	));

	if (voter == address(0) ) {
		// not registered?, slash!	
		slash(SlashReason.NOT_REGISTERED);
		return;
	} else {
		// registered, but zero balance? slash!  

		// check that the voter do not have any token
	        uint256 balance = storageProof.getERC20Balance(
			voter, 
			tokenAddress, 
			balanceMappingPosition,
			_blockHeaderRLP, 
			_balanceAccountStateProof, 
			_balanceStorageProof
		);
		require(balance == 0);
	
		slash(SlashReason.ZERO_BALANCE);
		return;
	}
	require(false, "not-able-to-challange");
 }

  function slash(SlashReason challangeResason) internal {
	challanged = true;
        emit Slashed(challangeResason);
  }

}
