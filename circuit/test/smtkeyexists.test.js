const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const tester = require("circom").tester;
const { assert } = require("chai");
const { Voter, Rollup } = require("../lib/rollup.js");

describe("Test voter added into the nullifiers tree", function () {
    this.timeout(0);

    const V1 = new Voter("0000000000000000000000000000000000000000000000000000000000000001");  
    const V2 = new Voter("0000000000000000000000000000000000000000000000000000000000000002");  

    let circuitPath = path.join(__dirname, "smtkeyexists.test.circom");
    let circuit;

    before( async() => {
	const circuitCode = `
            include "../src/smtkeyexists.circom";
            component main = SMTKeyExists(10);
        `;

        fs.writeFileSync(circuitPath, circuitCode, "utf8");
        circuit = await tester(circuitPath, {reduceConstraints:false});
        await circuit.loadConstraints();
    });

    after( async() => {
        fs.unlinkSync(circuitPath);
    });

    it("10 levels, 2 votes", async () => {
	let rollup = new Rollup(1,2,10);
	await rollup.rollup([
		await V1.vote(1n, 10000n),
		await V2.vote(1n, 10000n)
	]);
	let input = await rollup.smtkeyexists(V1.key.pbk.x);
	const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
	await circuit.checkConstraints(w);
    });

});

