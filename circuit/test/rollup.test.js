const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const tester = require("circom").tester;
const { assert } = require("chai");
const { Voter, Rollup } = require("../lib/rollup.js");

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
	console.log(circuitPath);
        circuit = await tester(circuitPath, {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints: " + circuit.constraints.length + "\n");
    });

    after( async() => {
        fs.unlinkSync(circuitPath);
    });

    it("1 batch, 1 vote, batchSize 2", async () => {
	console.log(V1.vote(10000n)); 

	let rollup = new Rollup(2,2);
	let input = await rollup.rollup([
		await V1.vote(10000n),
	]);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w);
	const hashInputs = w[1];
	console.log("inputsHash=",hashInputs);
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

