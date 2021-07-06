include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/sha256/sha256.circom";

template VoteRollup(nBatchSize, nLevels) {

	signal input hashInputs;

	signal private input oldNullifiersRoot;
	signal private input newNullifiersRoot;
	signal private input result;
	signal private input nVotes;
	
	signal private input votePbkAx[nBatchSize]; 
	signal private input votePbkAy[nBatchSize];
	signal private input voteSigS[nBatchSize];
	signal private input voteSigR8x[nBatchSize];
	signal private input voteSigR8y[nBatchSize];
	signal private input voteValue[nBatchSize];
	signal private input voteNullifierSiblings[nBatchSize][nLevels+1];
	signal private input voteOldKey[nBatchSize];
	signal private input voteOldValue[nBatchSize];
	signal private input voteIsOld0[nBatchSize];

/*	
    	/// check sha256 of inputs ------------------------------------------------
	var offset = 0;
	component inputsHasher = Sha256(256 * (4 + nBatchSize));

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

   	component n2bBatchSize = Num2Bits(256);
	n2bBatchSize.in <== batchSize;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bBatchSize.out[b];
    	}
	offset += 256;

	component n2bVotePbkAx[nBatchSize];
	for (var i = 0; i< nBatchSize ; i++) {
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

	hashInputs === n2bHashInputsOut.out; 
*/
	/// check votes -------------------------------------------------------------- 
	var computedResult = 0;
	
	component sigVerification[nBatchSize];
	component processor[nBatchSize];
	component verify[nBatchSize];
	component isLast[nBatchSize];
	component lastRootEqual[nBatchSize];
	
	for (var i=0; i<nBatchSize; i++) {
		verify[i] = LessThan(32);
		verify[i].in[0] <== i; 
		verify[i].in[1] <== nVotes; 

		isLast[i] = IsEqual();
		isLast[i].in[0] <== i; 
		isLast[i].in[1] <== nVotes - 1; 

		/// verify vote signature
		////////////////
		sigVerification[i] = EdDSAPoseidonVerifier();
		sigVerification[i].enabled <==  verify[i].out;
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
		for (var n=0;n<nLevels+1;n++) {
			processor[i].siblings[n] <== voteNullifierSiblings[i][n];
		}
		processor[i].fnc[0] <== verify[i].out;
		processor[i].fnc[1] <== 0;
		processor[i].oldKey <== voteOldKey[i];
		processor[i].oldValue <== voteOldValue[i];
		processor[i].isOld0 <== voteIsOld0[i];
		processor[i].newKey <== votePbkAx[i];
		processor[i].newValue <== 0;
		
		lastRootEqual[i] = ForceEqualIfEnabled();
		lastRootEqual[i].enabled <== isLast[i].out;
		lastRootEqual[i].in[0] <== processor[i].newRoot;
		lastRootEqual[i].in[1] <== newNullifiersRoot;
		computedResult = computedResult + voteValue[i];
	}

	result === computedResult;

}

