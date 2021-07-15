const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const PORT = 8080;
const fs = require('fs');
const rollup = require('../../circuit/lib/rollup.js');
const snarkjs = require('snarkjs');
const { ethers } = require("ethers");
const path = require('path');
const solc = require('solc');
class logger {
   debug(info) { console.log(info); } 
}


const circuitFile = "../../contract/circuits/circuit.circom";
const wasmFile = "../../contract/circuits/release/circuit.wasm";	
const zkeyFile = "../../contract/circuits/release/circuit_final.zkey";
const VoteRollup = require("../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json");
const provider = new ethers.providers.InfuraProvider("rinkeby", "e43c5d110ec1432fa9071b65e9117a62");
const wallet = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d", provider)    
const factory = ethers.ContractFactory.fromSolidity(VoteRollup,wallet);
//let rollupContract = factory.attach("0xeC4e0Ce60A7D206bDf5526a63eFD0e468628dA67");
let rollupContract; 

let roll = new rollup.Rollup(4,10);

    let vote1 = {
      votePbkAx: 1891156797631087029347893674931101305929404954783323547727418062433377377293n,
      votePbkAy: 14780632341277755899330141855966417738975199657954509255716508264496764475094n,
      voteSigS: 2579303388791659297061741374259677256055471270157957617441871160947938236302n,
      voteSigR8x: 4169647747207844899008945677173352998397531400871861924863807786029787501129n,
      voteSigR8y: 13234254701081026247559786141627733699298399787058355512361580794574298511208n,
      voteValue: 10000n
    };
    let vote2 = {
      votePbkAx: 16854128582118251237945641311188171779416930415987436835484678881513179891664n,
      votePbkAy: 8120635095982066718009530894702312232514551832114947239433677844673807664026n,
      voteSigS: 1289667425188663527301547897148053480741735311212388730155024428617701775067n,
      voteSigR8x: 5185043236230681587770576416729920700422030389941705044741070068870980306841n,
      voteSigR8y: 16083573068790244508443733511966101947915992518537382924811938334526672670742n,
      voteValue: 1001n
    };
    let vote3 = {  
      votePbkAx: 17184842423611758403179882610130949267222244268337186431253958700190046948852n,
      votePbkAy: 14002865450927633564331372044902774664732662568242033105218094241542484073498n,
      voteSigS: 2049813369450170712099093026932660045613544503110336874696805294622390016342n,
      voteSigR8x: 8204744364490105328554116836317003177988863429190035873687958664430585664479n,
      voteSigR8y: 4101212434332942618020382476068892889423108712471493181819736156552069281955n,
      voteValue: 30000n
    };


async function do_deploy() {
    console.log("deploying contract...");
    rollupContract = await factory.deploy();
    console.log("deploy tx  ",rollupContract.deployTransaction.hash);
    await rollupContract.deployTransaction.wait()
    console.log("deployed");
}

async function do_rollup(votes) {
    let input = await roll.rollup(votes);
    let proof = await snarkjs.groth16.fullProve(input,wasmFile,zkeyFile, new logger() );
    let callData = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

function h256(n) {
    let nstr = n.toString(16);
    while (nstr.length < 64) nstr = "0"+nstr;
    nstr = `0x${nstr}`;
    return nstr;
}

    console.log("sending tx...");
    let tx = await rollupContract.collect(
	h256(input.newNullifiersRoot),
	input.result,
	input.nVotes,
	input.votePbkAx.map(v=>h256(v)),
	[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
	[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
	[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
    );
    let res = await tx.wait();
    console.log(res);
    console.log("tx mined",res.events[0].args);
    
    return 1; // collectParams;
}

(async () => {
    try {
        await start()
	    ;
    } catch (e) {
        console.log(e);
    }
})();

async function start() {

	if (rollupContract === undefined ) {
		await do_deploy();
	}
	await do_rollup([vote1,vote2]);
	await do_rollup([vote3]);

	let apiRouter = express.Router();
	apiRouter.get('/', async (req, res, next)=>{
    	try {
        	res.status(200).json(await do_rollup());
    	} catch(e) {
       		console.log(e);
        	res.sendStatus(500);
    	}
	});

	app.use(bodyParser.json());
	app.use(cors());
	app.use(morgan('dev'));
	app.use('/api',apiRouter)

	app.listen(PORT, ()=>{
    		console.log(`server is listening  on ${PORT}`);
	});
}

