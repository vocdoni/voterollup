const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const tester = require("circom").tester;
const { assert } = require("chai");
const { Voter, Rollup } = require("../lib/rollup.js");

describe("Test rollup", function () {
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
	let rollup = new Rollup(1,2,2);
	let input = await rollup.rollup([
		await V1.vote(1n,10000n),
	]);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w);
	const hashInputs = w[1];
    });

    it("1 batch, 2 votes, batchSize 2", async () => {
	let rollup = new Rollup(1n,2,2);
	let input = await rollup.rollup([
		await V1.vote(1n,10000n),
		await V2.vote(1n,10001n),
	]);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w); 
    });

    it("2 batches, 3 votes, batchSize 2", async () => {
	let rollup = new Rollup(1n,2,2);
	let input1 = await rollup.rollup([
		await V1.vote(1n,10000n),
		await V2.vote(1n,10001n),
	]);
	const w1 = await circuit.calculateWitness(input1, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w1); 

	let input2 = await rollup.rollup([
		await V3.vote(1n,30000n),
	]);

	const w2 = await circuit.calculateWitness(input2, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w2); 
    });

    it("Ensure that voteValues that don't have their signature are not counted", async () => {
	// The circuit should not allow a prover to generate a valid proof
	// without real votes (real votes = voteValue + valid signature), as
	// then, it would be possible to present a proof that would pass
	// verifications, claiming a result that has no real votes. Meaning
	// that a prover could provide a valid zk-proof claiming a result
	// without real votes behind it, and the verification would accept it.
	// 
	// If this test fails, means that a prover could provide a valid
	// zk-proof claiming a result without real votes behind it.

	let rollup = new Rollup(1n,2,2);
	let input = await rollup.rollup([
	    await V1.vote(1n,10000n),
	]);

	// add the extra non-valid vote (without any signature)
	input.voteValue[1] = 30000n;

	// result should still be 10000, without counting that extra 30000
	// voteValue that does not have any signature. Set the result to 40000
	// simulating a malicious prover, to check if the circuit does not
	// accept it.
	input.result = 40000n;

	try {
	    const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	    await circuit.checkConstraints(w);

	    // The line will only be reached if no error is thrown above
	    throw new Error(`If this line is reached, means that the circuit`+
		`counted in the result invalid votes that don't have signatures.`);
	} catch(err) {
	    // the fake vote with value 30000 should not be included in the result
	    expect(err.message).to.not.contain("If this line is reached, means that");
	}
    });
});
