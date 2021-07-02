include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/sha256/sha256.circom";

template VoteRollup(nVotes, nLevels) {
	signal output hashInputs;

	signal private input oldNullifiersRoot;
	signal private input newNullifiersRoot;
	signal private input result;

	signal private input votePbkAx[nVotes]; // this acts as a nullifier
	signal private input votePbkAy[nVotes];
	signal private input voteSigS[nVotes];
	signal private input voteSigR8x[nVotes];
	signal private input voteSigR8y[nVotes];
	signal private input voteValue[nVotes];
	signal private input voteNullifierSiblings[nVotes][nLevels+1];
	
    	/// check sha256 of inputs ------------------------------------------------
	var offset = 0;
	component inputsHasher = Sha256(256 * (3 + nVotes));

    	component n2bOldNullifiersRoot = Num2Bits(256);
	n2bOldNullifiersRoot.in <== oldNullifiersRoot;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bOldNullifiersRoot.out[b];
    	}
	offset += 256;

    	component n2bNewNullifiersRoot = Num2Bits(256);
	n2bNewNullifiersRoot.in <== newNullifiersRoot;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bNewNullifiersRoot.out[b];
    	}
	offset += 256;

    	component n2bResult = Num2Bits(256);
	n2bResult.in <== result;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bResult.out[b];
    	}
	offset += 256;

	component n2bVotePbkAx[nVotes];
	for (var i = 0; i< nVotes ; i++) {
		n2bVotePbkAx[i] = Num2Bits(256);
		n2bVotePbkAx.in <== votePbkAx[i];
		for (var b=0;b<256;b++) {
        		inputsHasher.in[offset + b] <== n2bVotePbkAx[i].out[b];
		}
		offset += 256
	}

   	component n2bHashInputsOut = Bits2Num(256);
    	for (var i = 0; i < 256; i++) {
        	n2bHashInputsOut.in[i] <== inputsHasher.out[255-i];
    	}

	hashInputs <== n2bHashInputsOut.out; 

	/// check votes -------------------------------------------------------------- 
	var computedResult = 0;
	component sigVerification[nVotes];
	component processor[nVotes];
	
	for (var i=0; i<nVotes; i++) {
		
		/// verify vote signature
		////////////////
		sigVerification[i] = EdDSAPoseidonVerifier();
		sigVerification[i].enabled <== 1;
		sigVerification[i].Ax <== votePbkAx[i];
		sigVerification[i].Ay <== votePbkAy[i];
		sigVerification[i].S <== voteSigS[i];
		sigVerification[i].R8x <== voteSigR8x[i];
		sigVerification[i].R8y <== voteSigR8y[i];
		sigVerification[i].M <== voteValue[i];

		/// verify addition into nullifier tree
	 	////////////////	
		processor[i] = SMTProcessor(nLevels+1);
		if (i==0) {
			processor[i].oldRoot <== oldNullifiersRoot;
		} else {
			processor[i].oldRoot <== processor[i-1].newRoot;
		}
		for (var n=0;n<nLevels;n++) {
			processor[i].siblings[i] <== voteNullifierSiblings[i][n];
		}
		processor[i].fnc[0] <== 1;
		processor[i].fnc[1] <== 0;
		processor[i].oldKey <== 0;
		processor[i].oldValue <== 0;
		processor[i].newKey <== votePbkAx[i];
		processor[i].newValue <== 0;
		// not sure if we have to check if processor[i].oldRoot != processor[i].newRoot
	
		/// update result
		//////////////////
		computedResult = computedResult + voteValue[i];	

	}
	result === computedResult;
	newNullifiersRoot <== processor[nVotes-1].newRoot;
} 
