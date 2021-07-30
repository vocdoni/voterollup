const fs = require('fs');
const rollup = require('../../circuit/lib/rollup.js');
const snarkjs = require('snarkjs');
const { ethers } = require("ethers");
const path = require('path');
const solc = require('solc');
class logger {
   debug(info) { console.log(info); } 
}

const { ERC20Prover } = require('@vocdoni/storage-proofs-eth');
const ERC20ContractABI = require('./erc20.abi.json');
const VoteRollupContract = require("../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json");
const RegistryContract = require("../../contract/artifacts/contracts/Registry.sol/Registry.json");

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

class RollupServer {

	constructor(web3url, walletPvk,log ) {
		if (log === undefined ) {
			log = console.log;
		}
		this.log = log;
		this.web3Url = web3url;
		this.provider = new ethers.providers.JsonRpcProvider(this.web3Url);
		this.wallet = new ethers.Wallet(walletPvk, this.provider)    
		this.rollupWasmFile = "../../contract/circuits/release/rollup.wasm";	
		this.rollupZkeyFile = "../../contract/circuits/release/rollup.zkey";
		this.smtKeyExistsWasmFile = "../../contract/circuits/release/smtkeyexists.wasm";	
		this.smtKeyExistsZkeyFile = "../../contract/circuits/release/smtkeyexists.zkey";
		this.votingId = null;
		this.tokenAddress = null;
		this.tokenSlot= null;
		this.tokenBlockNumber = null;
		this.tokenBlockHash = null;
		this.tokenERC20 = null;
		this.rollupContract = null;
		this.rollupBatchSize = 4;
		this.rollupLevels = 10; 
		this.roll = null;
		this.rollEntries = []
		this.registryContract = null;
	}

	b256(n) {
	   let nstr = n.toString(16);
	   while (nstr.length < 64) nstr = "0"+nstr;
	   nstr = `0x${nstr}`;
	   return nstr;
	}

	async attach(address) {
	    this.rollupContract = new ethers.Contract(address, VoteRollupContract.abi, this.wallet);
	    this.registryContract = new ethers.Contract(await this.rollupContract.registry(), RegistryContract.abi, this.wallet);
	    this.log("[ATTACH-VOT] binding to address ",  address, "reg", this.registryContract.address);
	}

	async attachVotingId(votingId, tokenAddress, slotId, tokenBlockNumber, tokenBlockHash) {
	    this.tokenAddress = tokenAddress;
	    this.tokenSlot = slotId;
	    this.tokenBlockNumber = tokenBlockNumber;
	    this.tokenBlockHash = tokenBlockHash;
	    this.votingId = votingId;
	    this.log("[ATTACH-VOTINGID] votingId=",this.votingId);
	    this.roll = new rollup.Rollup(BigInt(this.votingId), this.rollupBatchSize,this.rollupLevels);
	}

	async deployRegistry() {
	    this.log("[DEPLOY-REG] deploying Registry contract");
	    const factory = ethers.ContractFactory.fromSolidity(RegistryContract,this.wallet);
	    this.registryContract = await factory.deploy();
	    this.log("[DEPLOY-REG] waiting tx ",this.registryContract.deployTransaction.hash);
	    await this.registryContract.deployTransaction.wait()
	    this.log("[DEPLOY-REG] done, address is ",this.registryContract.address);
	    return this.registryContract.address;
	}

	async deployVoting(registry) { 
	    this.log("[DEPLOY-VOT] deploying VoteRollup contract");
	    const factory = ethers.ContractFactory.fromSolidity(VoteRollupContract,this.wallet);
	    this.rollupContract = await factory.deploy(registry);
	    this.log("[DEPLOY-VOT] waiting tx ",this.rollupContract.deployTransaction.hash);
	    await this.rollupContract.deployTransaction.wait()
	    this.log("[DEPLOY-VOT] done, address is ",this.rollupContract.address);
	    this.registryContract = new ethers.Contract(registry, RegistryContract.abi, this.wallet);
	}
	
	async start(tokenAddress, slotId) { 
	    let tx = await this.rollupContract.start(tokenAddress, slotId);
	    this.log("[START] creating new voting...", tx.hash);
	    let res = await tx.wait();
	    this.tokenAddress = tokenAddress;
	    this.tokenSlot = slotId;
	    this.tokenBlockNumber = Number(res.events[0].args[3]);
	    this.tokenBlockHash = res.events[0].args[4];
	    console.log("tokenBlockHash", this.tokenBlockHash);
	    this.votingId = res.events[0].args[0];
	    this.log("[START] done votingId=",this.votingId);
	    this.roll = new rollup.Rollup(BigInt(this.votingId), this.rollupBatchSize,this.rollupLevels);
	}

	async rollup(votes) {
	    this.rollEntries.push(...Array.from(votes, v => v.votePbkAx));
	    for (let n=0;n<votes.length;n++) {
		let bbj = votes[n].votePbkAx;
		let addr = await this.registryContract.bbj2addr(bbj , { blockTag: this.tokenBlockNumber } );
	    	this.log("[ROLLUP] rolling up vote ", bbj," => ", addr);
	    }

	    this.log("[ROLLUP] generating proof");
	    let input = await this.roll.rollup(votes);
	    let proof = await snarkjs.groth16.fullProve(input,this.rollupWasmFile,this.rollupZkeyFile /*, new logger()*/ );
	 
	    let tx = await this.rollupContract.collect(
		this.votingId,
		this.b256(input.newNullifiersRoot),
		input.result,
		input.nVotes,
		input.votePbkAx,
		[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
		[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
		[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
	    );
	    
	    this.log("[ROLLUP] sending tx...", tx.hash);
	    let res = await tx.wait();
	    this.log("[ROLLUP] rollup done");
	}

	async _getERC20StorageProof(holderAddress) {
	   const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, this.tokenSlot)
	   const storageProver = new ERC20Prover(this.web3Url)
	   const data = await storageProver.getProof(this.tokenAddress, [balanceSlot], this.tokenBlockNumber, true)
	   return data;
	}


	async _getBbjStorageProof(bbjKey) {
	   const bbjSlot = ERC20Prover.getMappingSlot(bbjKey, 1);
	   const storageProver = new ERC20Prover(this.web3Url)
	   const data = await storageProver.getProof(this.registryContract.address, [bbjSlot], this.tokenBlockNumber, true)
	   return data;
	}

	async _challange(rollEntriesNew, bbjPbk, ethAddress) {
	   this.log("[CHALLANGE] generating...");	
	
	   // create new rollup with the entries
	   let roll = new rollup.Rollup(this.rollupBatchSize, this.rollupLevels);
	   await roll.insert(this.rollEntries);
	   await roll.insert(rollEntriesNew);

	   // check if the nullifier root is ok
	   const voting = await this.rollupContract.votings(this.votingId);
	   
	   const root = BigInt(voting.nullifierRoot);
	   if (root != roll.nullifiers.root) {
	       throw  "UNABLE TO CHALLANGE, ROOT IS NOT UPDATED";
	   }

	   // create proof-of-inclusion proof
	   let input = await roll.smtkeyexists(bbjPbk);
	   let proof = await snarkjs.groth16.fullProve(input,this.smtKeyExistsWasmFile,this.smtKeyExistsZkeyFile/*, new logger()*/ );

	   // get the bbk => eth proof
	   const bbjStorageProof = await this._getBbjStorageProof(bbjPbk);
	   let erc20StorageProof = { blockHeaderRLP : "0x00", accountProofRLP : "0x00", storageProofsRLP : [ "0x00"] };
	   if (ethAddress != null ) {
		// get the erc20(eth) == 0 proof
		erc20StorageProof = await this._getERC20StorageProof(ethAddress);
	   }

           let challangeInput = [
		this.tokenAddress,
		this.tokenSlot,
		this.tokenBlockNumber,
		this.tokenBlockHash,

		bbjPbk,
		bbjStorageProof.blockHeaderRLP,
		
		bbjStorageProof.accountProofRLP,
		bbjStorageProof.storageProofsRLP[0],	
		
		erc20StorageProof.accountProofRLP,
		erc20StorageProof.storageProofsRLP[0],
		
		[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
		[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
		[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
	   ];

	console.log(challangeInput);

	   let tx = await this.rollupContract.challange(challangeInput);
	   this.log("[CHALLANGE] sending tx...", tx.hash);
	    
	   let res = await tx.wait();
	   this.log("[CHALLANGE] challanged ", res.logs[0]);
	}

	async startListenAndChallange() {
		this.log("[CHALLANGER] start listening....");
		this.rollupContract.on("Voted", async (votingId, count, voters) => {
			if (votingId != this.votingId) {
				this.log("[CHALLANGER] ignoring votingId", votingId, "!=", this.votingId);
				return;
			}
			this.log("[CHALLANGER] verifying votes ", voters.map(n => n.toString()));
			
			//  get new nullifiers
			let rollEntriesNew = [];
			for (let n=0;n<count;n++) {
				if (!this.rollEntries.includes(voters[n])) {
					rollEntriesNew.push(voters[n]);
				}
			}
			// try to challange
			for (let n=0;n<count;n++) {
				const ethAddress = await this.registryContract.bbj2addr(voters[n], { blockTag: this.tokenBlockNumber });
				if (ethAddress == ZERO_ADDR) {
					this.log("[CHALLANGER] bbj not registered ", voters[n].toString()); 
					await this._challange(rollEntriesNew, voters[n], null);
					return;
				}
				let balance = await this.tokenERC20.balanceOf(ethAddress, { blockTag: this.tokenBlockNumber });  
				if (balance == 0) {
					this.log("[CHALLANGER] bbj registered, but ethaddress balance is zero ", ethAddress, voters[n].toString());
					await this._challange(rollEntriesNew, voters[n], ethAddress);
					return;
				}
				this.log("[CHALLANGER] vote ok ",voters[n].toString(), ethAddress, balance.toString());
			}

			for (let n=0;n<rollEntriesNew.length;n++) {
				this.rollEntries.push(rollEntriesNew[n]);
				this.roll.insert([rollEntriesNew[n]]);
			}
		})
	}
}
module.exports = { RollupServer, VoteRollupContract, RegistryContract } 
