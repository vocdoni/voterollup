const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;

const bigInt = require("snarkjs").bigInt;
const { assert } = require("chai");
const createBlakeHash = require("blake-hash");
const { babyJub, eddsa, smt, poseidon } = require("circomlib");
const ffutils = require("ffjavascript").utils;
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");

class Voter {
    constructor(rawpvkHex) {
       const rawpvk = Buffer.from(rawpvkHex, "hex");
       const rawpvkHash = eddsa.pruneBuffer(createBlakeHash("blake512").update(rawpvk).digest().slice(0, 32));
       const pvk = Scalar.shr(ffutils.leBuff2int(rawpvkHash),3);
       const A = babyJub.mulPointEscalar(babyJub.Base8, pvk);
       this.key = { rawpvk , pvk , pbk : { x: A[0], y: A[1] } }
   }

    vote(voteValue) {
        const signature = eddsa.signPoseidon(this.key.rawpvk, voteValue);

        return {
            votePbkAx: this.key.pbk.x,
	    votePbkAy: this.key.pbk.y,
	    
	    voteSigS: signature.S,
            voteSigR8x: signature.R8[0],
            voteSigR8y: signature.R8[1],
 
            voteValue,
        }
    }
}

class Rollup {
    constructor(batchSize, levels) { 
       this.nullifiers = null;
       this.batchSize = batchSize;
       this.levels = levels;
    }
    async rollup(votes) {
	assert(votes.length <= this.batchSize);
	if (this.nullifiers == null) {
	   this.nullifiers = await smt.newMemEmptyTrie();
	}
	var input = {
		hashInputs : 0n,

		nVotes: votes.length,
		oldNullifiersRoot: this.nullifiers.root,
		newNullifiersRoot: 0n,
		result: 0n,

		votePbkAx : [], 
		votePbkAy : [],
		voteSigS : [],
		voteSigR8x : [],
		voteSigR8y: [],
		voteValue : [],
		voteNullifierSiblings: [],
		voteOldKey: [],
		voteOldValue: [],
		voteIsOld0: []
	};

	let result = 0n;
        input.voteNullifierSiblings = [];
	for (var n = 0; n<votes.length;n++) {
		input.votePbkAx.push(votes[n].votePbkAx);
		input.votePbkAy.push(votes[n].votePbkAy);
		input.voteSigS.push(votes[n].voteSigS);
		input.voteSigR8x.push(votes[n].voteSigR8x);
		input.voteSigR8y.push(votes[n].voteSigR8y);
		input.voteValue.push(votes[n].voteValue);

        	let res = await this.nullifiers.insert(votes[n].votePbkAx, 0n);
        	let siblings = res.siblings;
        	while (siblings.length < this.levels+1) siblings.push(BigInt(0));

		input.voteNullifierSiblings.push(siblings);
		input.voteOldKey.push(res.oldKey);
		input.voteOldValue.push(res.oldValue);
		input.voteIsOld0.push(res.isOld0?1n:0n);

		result = result + votes[n].voteValue; 
	
		if (n == 0) {
			input.oldNullifiersRoot = res.oldRoot;
		}
		if (n == votes.length - 1) {
			input.newNullifiersRoot = res.newRoot;
		}

	}
	for (var n = votes.length ; n < this.batchSize; n++) {
		input.votePbkAx.push(0n);
		input.votePbkAy.push(0n);
		input.voteSigS.push(0n);
		input.voteSigR8x.push(0n);
		input.voteSigR8y.push(0n);
		input.voteValue.push(0n);

		input.voteOldKey.push(0n);
		input.voteOldValue.push(0n);
		input.voteIsOld0.push(0n);

        	let siblings = [];
        	while (siblings.length < this.levels+1) siblings.push(BigInt(0));

		input.voteNullifierSiblings.push(siblings);
	}

	input.result = result;

	var hash = crypto.createHash('sha256');
	hash.update(ffutils.leInt2Buff(input.oldNullifiersRoot,32));
	hash.update(ffutils.leInt2Buff(input.newNullifiersRoot,32));
	hash.update(ffutils.leInt2Buff(input.result,32));

	for (var n = 0; n<votes.length; n++){
		hash.update(ffutils.leInt2Buff(votes[n].votePbkAx),32);
	}
	input.hashInputs = ffutils.leBuff2int(hash.digest());
	
	return input;
    }	    
}

describe("dummy", function () {
    this.timeout(0);

    const V1 = new Voter("0000000000000000000000000000000000000000000000000000000000000001");  
    const V2 = new Voter("0000000000000000000000000000000000000000000000000000000000000002");
    const V3 = new Voter("0000000000000000000000000000000000000000000000000000000000000003");

    let circuitPath = path.join(__dirname, "voterollup.test.circom");
    let circuit;

    before( async() => {
	const circuitCode = `
            include "../src/voterollup.circom";
            component main = VoteRollup(2,2);
        `;

        fs.writeFileSync(circuitPath, circuitCode, "utf8");

        circuit = await tester(circuitPath, {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints: " + circuit.constraints.length + "\n");
    });

    after( async() => {
        fs.unlinkSync(circuitPath);
    });

    it("1 batch, 1 vote, batchSize 2", async () => {
	let rollup = new Rollup(2,2);
	let input = await rollup.rollup([
		await V1.vote(10000n),
	]);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w); 
    });

    it("1 batch, 2 votes, batchSize 2", async () => {
	let rollup = new Rollup(2,2);
	let input = await rollup.rollup([
		await V1.vote(10000n),
		await V2.vote(10001n),
	]);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w); 
    });

    it("2 batches, 3 votes, batchSize 2", async () => {

	let rollup = new Rollup(2,2);
	let input1 = await rollup.rollup([
		await V1.vote(10000n),
		await V2.vote(10001n),
	]);
	const w1 = await circuit.calculateWitness(input1, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w1); 

	let input2 = await rollup.rollup([
		await V3.vote(30000n),
	]);
	
	const w2 = await circuit.calculateWitness(input2, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w2); 

    });
});

