const JSPROVER = false;

const fs = require('fs');
const snarkjs = require('snarkjs');
const { ethers } = require("ethers");
const path = require('path');
const solc = require('solc');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const tmp = require('tmp');

class logger {
   debug(info) { console.log(info); } 
}

const { ERC20Prover } = require('@vocdoni/storage-proofs-eth');
const ERC20ContractABI = require('./erc20.abi.json');
const VoteRollupContract = require("../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json");
const RegistryContract = require("../../contract/artifacts/contracts/Registry.sol/Registry.json");
const rollup = require('../../circuit/lib/rollup.js');


const ROLLUP_CIRCUIT = "../../contract/circuits/rollup.circom";
const SMTKEYEXISTS_CIRCUIT = "../../contract/circuits/smtkeyexists.circom";
const CIRCUIT_PATH="../../contract/circuits/release";
const PROVER_BIN="prover/rapidsnark/build/prover";
const WITGEN_BIN_PATH="prover";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

class ZKProver {
	constructor(js, circuit, log) {
		this.circuit = circuit; 
		this.js = js;
		this.log = log;
	}
	async prove(input) {
		if (this.js) {
			return await snarkjs.groth16.fullProve(input,
				CIRCUIT_PATH+"/"+this.circuit+".wasm",
				CIRCUIT_PATH+"/"+this.circuit+".zkey"
				/*, new logger()*/ 
			);
		} else {
			const prefix = tmp.fileSync({ mode: 0o644, prefix: this.circuit+'-'}).name;
			const inputsFile = prefix+".input.json";
			const wtnsFile = prefix + ".wtns";
			const proofFile = prefix + ".proof.json";
			const publicInputsFile = prefix + ".public.json";
		        // this.log("Writing circuit ",this.circuit," inputs to ",inputsFile); 
			input = JSON.stringify(input, (k,v) => typeof v === "bigint" ? v.toString() : v )
			fs.writeFileSync(inputsFile, input);

			const genWitnessCmd = `${WITGEN_BIN_PATH}/${this.circuit} ${inputsFile} ${wtnsFile}`;
			// this.log("Running \'"+genWitnessCmd+"\'...");
			await exec(genWitnessCmd);
			
			const proveCmd = `${PROVER_BIN} ${CIRCUIT_PATH}/${this.circuit}.zkey ${wtnsFile} ${proofFile} ${publicInputsFile}`;
			// this.log("Running \'"+proveCmd+"\'...");
			await exec(proveCmd);
		
			let proof = fs.readFileSync(proofFile); 
		 	proof = JSON.parse(proof, (k,v) => typeof v === "string" && v!= "groth16" ? BigInt(v) : v) ;
			return { proof : proof };
		}
	}
}

class RollupServer {

	constructor(web3url, walletPvk,log ) {
		if (log === undefined ) {
			log = console.log;
		}
		let [, rollupBatchSize, rollupLevels] = fs.readFileSync(ROLLUP_CIRCUIT,'utf8').match(/VoteRollup\(([0-9]*),([0-9]*)\)/);
		let [, smtKeyExstLevels] = fs.readFileSync(SMTKEYEXISTS_CIRCUIT,'utf8').match(/SMTKeyExists\(([0-9]*)\)/);

		this.rollupBatchSize = parseInt(rollupBatchSize);
		this.rollupLevels = parseInt(rollupLevels); 
	
		if (this.rollupBatchSize < 1 || this.rollupLevels < 1 || this.rollupLevels != parseInt(smtKeyExstLevels)) {
			throw "Cannot get the contents of the rollup circuits";
		}

		this.log = log;
		this.web3Url = web3url;
		this.provider = new ethers.providers.JsonRpcProvider(this.web3Url);
		this.wallet = new ethers.Wallet(walletPvk, this.provider)    
		this.rollupProver = new ZKProver(JSPROVER, "rollup", log);	
		this.smtKeyExistsProver = new ZKProver(JSPROVER, "smtkeyexists", log);	
		this.votingId = null;
		this.tokenAddress = null;
		this.tokenSlot= null;
		this.tokenBlockNumber = null;
		this.tokenBlockHash = null;
		this.tokenERC20 = null;
		this.rollupContract = null;
		this.roll = null;
		this.rollEntries = []
		this.registryContract = null;
		log("Loaded engine for BATCHSIZE=",this.rollupBatchSize, "LEVELS=", this.rollupLevels);
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
	    this.tokenERC20 = new ethers.Contract(this.tokenAddress, ERC20ContractABI, this.wallet);
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
	    this.votingId = res.events[0].args[0];
	    this.log("[START] done votingId=",this.votingId);
	    this.roll = new rollup.Rollup(BigInt(this.votingId), this.rollupBatchSize,this.rollupLevels);
	    this.tokenERC20 = new ethers.Contract(this.tokenAddress, ERC20ContractABI, this.wallet);
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
	    let proof = await this.rollupProver.prove(input);
	 
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
	   this.log("[CHALLANGE] generating challange...");	
	
	   // create new rollup with the entries
	   let roll = new rollup.Rollup(this.votingId, this.rollupBatchSize, this.rollupLevels);
	   await roll.insert(this.rollEntries);
	   await roll.insert(rollEntriesNew);

	   // check if the nullifier root is ok
	   const voting = await this.rollupContract.votings(this.votingId);
	   const root = BigInt(voting.nullifierRoot);
	   if (root != roll.nullifiers.root) {
	       throw  "UNABLE TO CHALLANGE, ROOT IS NOT UPDATED";
	   }

	   // create proof-of-inclusion proof
	   let input = await roll.smtkeyexists(BigInt(bbjPbk.toString()));
	   let proof = await this.smtKeyExistsProver.prove(input);

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
		[ proof.proof.pi_c[0], proof.proof.pi_c[1] ]
	   ];
	   let tx = await this.rollupContract.challange(challangeInput);
	   this.log("[CHALLANGE] sending tx...", tx.hash);
	    
	   await tx.wait();
	   this.log("[CHALLANGE] challanged ");
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
