include "../node_modules/circomlib/circuits/smt/smtverifier.circom";

template SMTKeyExists(nLevels) {
	signal input root;
	signal input key;
	signal private input siblings[nLevels+1];
	
        component verifier = SMTVerifier(nLevels+1);
    	verifier.enabled <== 1;
    	verifier.fnc <== 0; // verify inclusion
    	verifier.root <== root;
    	verifier.key <== key;
	verifier.value <== 0; 
	verifier.oldKey <== 0;
    	verifier.oldValue <== 0;
    	verifier.isOld0 <== 0;
	for (var i = 0; i<nLevels+1; i++) {
		verifier.siblings[i] <== siblings[i]; 	
	}
}

