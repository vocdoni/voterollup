const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;

const { assert } = require("chai");
const createBlakeHash = require("blake-hash");
const { babyJub, eddsa, smt, poseidon } = require("circomlib");
const ffutils = require("ffjavascript").utils;

class Voter {
    constructor(rawpvkHex) {
       const rawpvk = Buffer.from(rawpvkHex, "hex");
       const rawpvkHash = eddsa.pruneBuffer(createBlakeHash("blake512").update(rawpvk).digest().slice(0, 32));
       const pvk = Scalar.shr(ffutils.leBuff2int(rawpvkHash),3);
       const A = babyJub.mulPointEscalar(babyJub.Base8, pvk);
       this.key = { rawpvk , pvk , pbk : { x: A[0], y: A[1] } }
    }

    vote(voteElectionId, voteValue) {
	const signature = eddsa.signPoseidon(this.key.rawpvk, poseidon([voteElectionId, voteValue]) );

        return {
            votePbkAx: this.key.pbk.x,
	    votePbkAy: this.key.pbk.y,
	    
	    voteSigS: signature.S,
            voteSigR8x: signature.R8[0],
            voteSigR8y: signature.R8[1],
 
            voteElectionId,
	    voteValue,
        }
    }
}

class Rollup {
    constructor(electionId, batchSize, levels) { 
       this.nullifiers = null;
       this.batchSize = batchSize;
       this.levels = levels;
       this.electionId = electionId;
    }

    async smtkeyexists(key) {
	let siblings = (await this.nullifiers.find(key)).siblings;
    	while (siblings.length < this.levels+1) siblings.push(BigInt(0));
	return {
		root : this.nullifiers.root,
		siblings,
		key
	}
    }

    async insert(votePbks) {
  	if (this.nullifiers == null) {
	   this.nullifiers = await smt.newMemEmptyTrie();
	}
	for (let n=0;n<votePbks.length;n++) {
	    await this.nullifiers.insert(votePbks[n],0n);	
	}
    }

    async rollup(votes) {
	assert(votes.length <= this.batchSize);
	if (this.nullifiers == null) {
	   this.nullifiers = await smt.newMemEmptyTrie();
	}
	var input = {
		electionId : this.electionId,
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
		assert(votes[n].voteElectionId == this.electionId);
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

	return input;
    }	    
}

module.exports = {
    Voter,
    Rollup
};
