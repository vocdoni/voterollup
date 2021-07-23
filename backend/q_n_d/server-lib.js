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
const erc20abi = `[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]`;

const VoteRollupContract = require("../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json");

class RollupServer {

	constructor(web3url, walletPvk, tokenAddress, tokenSlot, tokenBlockNumber ) {
		this.web3Url = web3url;
		this.provider = new ethers.providers.JsonRpcProvider(this.web3Url);
		this.wallet = new ethers.Wallet(walletPvk, this.provider)    
		this.rollupWasmFile = "../../contract/circuits/release/rollup.wasm";	
		this.rollupZkeyFile = "../../contract/circuits/release/rollup.zkey";
		this.smtKeyExistsWasmFile = "../../contract/circuits/release/smtkeyexists.wasm";	
		this.smtKeyExistsZkeyFile = "../../contract/circuits/release/smtkeyexists.zkey";
		this.tokenAddress = tokenAddress;
		this.tokenSlot= tokenSlot;
		this.tokenBlockNumber = tokenBlockNumber;
		this.tokenERC20 = new ethers.Contract(this.tokenAddress, erc20abi, this.wallet);
		this.rollupContract = null;
		this.rollupBatchSize = 4;
		this.rollupLevels = 10; 
		this.roll = new rollup.Rollup(this.rollupBatchSize,this.rollupLevels);
		this.rollEntries = []
	}

	b256(n) {
	   let nstr = n.toString(16);
	   while (nstr.length < 64) nstr = "0"+nstr;
	   nstr = `0x${nstr}`;
	   return nstr;
	}

	async deploy() {
	    console.log("[DEPLOY] deploying contract...");
	    const block = await this.provider.getBlock(this.tokenBlockNumber);
	    const factory = ethers.ContractFactory.fromSolidity(VoteRollupContract,this.wallet);
	    this.rollupContract = await factory.deploy(
		    this.tokenAddress,
		    this.tokenSlot,
		    block.hash
	    );
	    console.log("[DEPLOY] waiting tx ",this.rollupContract.deployTransaction.hash);
	    await this.rollupContract.deployTransaction.wait()
	    console.log("[DEPLOY] done, address is ",this.rollupContract.address);
	}

	async rollup(votes) {
	    this.rollEntries.push(...Array.from(votes, v => v.votePbkAx));
	    console.log("[ROLLUP] rolling up votes for ", Array.from(votes, v => v.address));
	    console.log("[ROLLUP] generating proof");
	    let input = await this.roll.rollup(votes);
	    let proof = await snarkjs.groth16.fullProve(input,this.rollupWasmFile,this.rollupZkeyFile /*, new logger()*/ );
	    
	    let addrs = Array.from(votes, v => v.address );
	    while (addrs.length < this.roll.batchSize) addrs.push("0x0000000000000000000000000000000000000000"); 
	      
	    let tx = await this.rollupContract.collect(
		this.b256(input.newNullifiersRoot),
		input.result,
		input.nVotes,
		addrs,
		[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
		[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
		[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
	    );
	    
	    console.log("[ROLLUP] sending tx...", tx.hash);
	    let res = await tx.wait();
	    console.log("[ROLLUP] rollup done");
	}

	async _getStorageProof(holderAddress) {
	   const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, this.tokenSlot)
	   const storageProver = new ERC20Prover(this.web3Url)
	   const data = await storageProver.getProof(this.tokenAddress, [balanceSlot], this.tokenBlockNumber, true)
	   return data;
	}

	async _challange(rollEntriesNew, ethAddress) {
	   console.log("[CHALLANGE] generating proof addr ",ethAddress, " balance is zero");	
	  
	   let roll = new rollup.Rollup(this.rollupBatchSize, this.rollupLevels);
	   await roll.insert(this.rollEntries);
	   await roll.insert(rollEntriesNew);
	  
	   const storageProof = await this._getStorageProof(ethAddress);
	   const root = BigInt(await this.rollupContract.nullifierRoot());
	    
	   if (root != roll.nullifiers.root) {
	       throw  "UNABLE TO CHALLANGE, ROOT IS NOT UPDATED";
	   }

	   let bbjPbk = await this.rollupContract.keys(ethAddress) ;
	   let input = await roll.smtkeyexists(bbjPbk);
	   let proof = await snarkjs.groth16.fullProve(input,this.smtKeyExistsWasmFile,this.smtKeyExistsZkeyFile/*, new logger()*/ );
	   
	   let tx = await this.rollupContract.challange(
		ethAddress,
		storageProof.blockHeaderRLP,
		storageProof.accountProofRLP,
		storageProof.storageProofsRLP[0],
		[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
		[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
		[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
	    );
	    console.log("[CHALLANGE] sending tx...", tx.hash);
	    
	    let res = await tx.wait();
	    console.log("[CHALLANGE] challanged ");
	}

	async startListenAndChallange() {
		console.log("[CHALLANGER] start listening....");
		this.rollupContract.on("Voted", async (count, voters) => {
			console.log("[CHALLANGER] verifying votes ", voters);
			
			//  get new nullifiers
			let rollEntriesNew = [];
			for (let n=0;n<count;n++) {
				let bbjPbk = await this.rollupContract.keys(voters[n]) ;
				bbjPbk = BigInt(bbjPbk.toHexString());
				if (!this.rollEntries.includes(bbjPbk)) {
					rollEntriesNew.push(bbjPbk);
				}
			}
			// try to challange
			for (let n=0;n<count;n++) {
				const ethAddress = voters[n];
				if (await this.tokenERC20.balanceOf(ethAddress, { blockTag: this.tokenBlockNumber }) == 0) {
					await this._challange(rollEntriesNew, ethAddress);
					return;
				}
			}
			for (let n=0;n<rollEntriesNew.length;n++) {
				this.rollEntries.push(rollEntriesNew[n]);
				this.roll.nullifiers.insert(rollEntriesNew[n],0n);
			}
		})
	}
}
module.exports = { RollupServer, VoteRollupContract } 
