const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;

describe("dummy", function () {
    this.timeout(0);
    let circuitPath = path.join(__dirname, "fee-tx.test.circom");
    let circuit;

    let nLevels = 16;

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

    it("Should check empty fee-tx", async () => {
        /*
	const input = {
            oldStateRoot: 0,
            feePlanToken: 0,
            feeIdx: 0,
            accFee: 0,
            tokenID: 0,
            nonce: 0,
            sign: 0,
            balance: 0,
            ay: 0,
            ethAddr: 0,
            siblings: Array(nLevels+1).fill(0),
        };

        const w = await circuit.calculateWitness(input, { logTrigger:false, logOutput: false, logSet: false });
        await circuit.assertOut(w, { newStateRoot: 0 });
       */
       
    });
});

