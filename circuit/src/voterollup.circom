include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/sha256/sha256.circom";

template VoteRollup(nBatchSize, nLevels) {
	signal output hashInputs;

	// this will be the inputs of the smartcontract verifier method
	signal private input newNullifiersRoot;
	signal private input electionId;
        signal private input result;
	signal private input nVotes;
	signal private input votePbkAx[nBatchSize]; 

	signal private input oldNullifiersRoot;
	signal private input votePbkAy[nBatchSize];
	signal private input voteSigS[nBatchSize];
	signal private input voteSigR8x[nBatchSize];
	signal private input voteSigR8y[nBatchSize];
	signal private input voteValue[nBatchSize];
	signal private input voteNullifierSiblings[nBatchSize][nLevels+1];
	signal private input voteOldKey[nBatchSize];
	signal private input voteOldValue[nBatchSize];
	signal private input voteIsOld0[nBatchSize];
    	
	/// check sha256 of inputs ------------------------------------------------
	var offset = 0;
	component inputsHasher = Sha256(256 * (5 + nBatchSize));

    	component n2bOldNullifiersRoot = Num2Bits(256);
	n2bOldNullifiersRoot.in <== oldNullifiersRoot;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bOldNullifiersRoot.out[255-b];
	}
	offset += 256;
	
    	component n2bNewNullifiersRoot = Num2Bits(256);
	n2bNewNullifiersRoot.in <== newNullifiersRoot;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bNewNullifiersRoot.out[255-b];
    	}
	offset += 256;
	
    	component n2bResult = Num2Bits(256);
	n2bResult.in <== result;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bResult.out[255-b];
    	}
	offset += 256;
	 	
   	component n2bVotes = Num2Bits(256);
	n2bVotes.in <== nVotes;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bVotes.out[255-b];
    	}
	offset += 256;

   	component n2bElectionId = Num2Bits(256);
	n2bElectionId.in <== electionId;
	for (var b = 0; b < 256; b++) {
        	inputsHasher.in[offset + b] <== n2bElectionId.out[255-b];
    	}
	offset += 256;
        	
	component n2bVotePbkAx[nBatchSize];
	for (var i = 0; i< nBatchSize ; i++) {
		n2bVotePbkAx[i] = Num2Bits(256);
		n2bVotePbkAx[i].in <== votePbkAx[i];
		for (var b=0;b<256;b++) {
        		inputsHasher.in[offset + b] <== n2bVotePbkAx[i].out[255-b];
		}
		offset += 256
	}

   	component b2nHashInputsOut = Bits2Num(256);
	for (var i = 0; i < 256; i++) {
        	b2nHashInputsOut.in[i] <== inputsHasher.out[255-i];
    	}
	hashInputs <== b2nHashInputsOut.out; 

	/// check votes -------------------------------------------------------------- 
	
	signal computedResult[nBatchSize+1];
	computedResult[0] <== 0;
	
	component sigVerification[nBatchSize];
	component processor[nBatchSize];
	component verify[nBatchSize];
	component isLast[nBatchSize];
	component lastRootEqual[nBatchSize];
	component voteSignedValue[nBatchSize];
	
	for (var i=0; i<nBatchSize; i++) {
		verify[i] = LessThan(32);
		verify[i].in[0] <== i; 
		verify[i].in[1] <== nVotes; 

		isLast[i] = IsEqual();
		isLast[i].in[0] <== i; 
		isLast[i].in[1] <== nVotes - 1; 

		/// verify vote signature
		////////////////

		voteSignedValue[i] = Poseidon(2);
		voteSignedValue[i].inputs[0] <== electionId;	
		voteSignedValue[i].inputs[1] <== voteValue[i];

		sigVerification[i] = EdDSAPoseidonVerifier();
		sigVerification[i].enabled <==  verify[i].out;
		sigVerification[i].Ax <== votePbkAx[i];
		sigVerification[i].Ay <== votePbkAy[i];
		sigVerification[i].S <== voteSigS[i];
		sigVerification[i].R8x <== voteSigR8x[i];
		sigVerification[i].R8y <== voteSigR8y[i];
		sigVerification[i].M <== voteSignedValue[i].out;

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
		
		computedResult[i+1] <== computedResult[i] + voteValue[i] * verify[i].out;
	}

	result === computedResult[nBatchSize];
}
