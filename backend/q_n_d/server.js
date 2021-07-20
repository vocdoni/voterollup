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

const { ERC20Prover } = require('@vocdoni/storage-proofs-eth');
const rollupWasmFile = "../../contract/circuits/release/rollup.wasm";	
const rollupZkeyFile = "../../contract/circuits/release/rollup.zkey";
const smtKeyExistsWasmFile = "../../contract/circuits/release/smtkeyexists.wasm";	
const smtKeyExistsZkeyFile = "../../contract/circuits/release/smtkeyexists.zkey";


const erc20abi = `[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]`;

const VoteRollup = require("../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json");
const provider = new ethers.providers.JsonRpcProvider("https://rinkeby.vocdoni.net");
const web3Url = "https://rinkeby.vocdoni.net";
const wallet = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d", provider)    
const wallet2 = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976e", provider)    
const wallet3 = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976f", provider)    
const factory = ethers.ContractFactory.fromSolidity(VoteRollup,wallet);
const factory2 = ethers.ContractFactory.fromSolidity(VoteRollup,wallet2);
const factory3 = ethers.ContractFactory.fromSolidity(VoteRollup,wallet);
let rollupContract; 

const tokenAddress =    "0x81A99588B326679E2fbc2768F81622B62ed70033";
const balancePositionIdx = 0;
const blockNumber = 8959397;
const erc20Contract = new ethers.Contract(tokenAddress, erc20abi, wallet);

let roll = new rollup.Rollup(4,10);

let vote1 = {
  address: wallet.address,
  votePbkAx: 1891156797631087029347893674931101305929404954783323547727418062433377377293n,
  votePbkAy: 14780632341277755899330141855966417738975199657954509255716508264496764475094n,
  voteSigS: 2579303388791659297061741374259677256055471270157957617441871160947938236302n,
  voteSigR8x: 4169647747207844899008945677173352998397531400871861924863807786029787501129n,
  voteSigR8y: 13234254701081026247559786141627733699298399787058355512361580794574298511208n,
  voteValue: 10000n
};

let vote2 = {
  address: wallet2.address,
  votePbkAx: 16854128582118251237945641311188171779416930415987436835484678881513179891664n,
  votePbkAy: 8120635095982066718009530894702312232514551832114947239433677844673807664026n,
  voteSigS: 1289667425188663527301547897148053480741735311212388730155024428617701775067n,
  voteSigR8x: 5185043236230681587770576416729920700422030389941705044741070068870980306841n,
  voteSigR8y: 16083573068790244508443733511966101947915992518537382924811938334526672670742n,
  voteValue: 1001n
};

let vote3 = {  
  address: wallet3.address,
  votePbkAx: 17184842423611758403179882610130949267222244268337186431253958700190046948852n,
  votePbkAy: 14002865450927633564331372044902774664732662568242033105218094241542484073498n,
  voteSigS: 2049813369450170712099093026932660045613544503110336874696805294622390016342n,
  voteSigR8x: 8204744364490105328554116836317003177988863429190035873687958664430585664479n,
  voteSigR8y: 4101212434332942618020382476068892889423108712471493181819736156552069281955n,
  voteValue: 30000n
};

function b256(n) {
   let nstr = n.toString(16);
   while (nstr.length < 64) nstr = "0"+nstr;
   nstr = `0x${nstr}`;
   return nstr;
}

async function do_deploy() {
    console.log("deploying contract...");
    let tokenAddress = "0x0ebe88c216a7eaff0ae46ce01fd685303c4797bd";
    let tokenSlot = 0;
    let tokenBlockNumber = 8942234;
    rollupContract = await factory.deploy(
	    tokenAddress,
	    tokenSlot,
	    tokenBlockNumber
    );
    console.log("deploy tx ",rollupContract.deployTransaction.hash);
    await rollupContract.deployTransaction.wait()
    console.log("deployed");
}

async function do_rollup(votes) {
    let input = await roll.rollup(votes);
    let proof = await snarkjs.groth16.fullProve(input,rollupWasmFile,rollupZkeyFile /*, new logger()*/ );
    let callData = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);
    
    let addrs = Array.from(votes, v => v.address );
    while (addrs.length < roll.batchSize) addrs.push("0x0000000000000000000000000000000000000000"); 
   
    console.log(addrs);

    console.log("sending rollup tx...");
      
    let tx = await rollupContract.collect(
	b256(input.newNullifiersRoot),
	input.result,
	input.nVotes,
	addrs,
	[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
	[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
	[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
    );
    
    let res = await tx.wait();
    console.log("rollup tx mined");
}

async function getStorageProof(holderAddress) {
	const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, balancePositionIdx)
	const storageProover = new ERC20Prover(web3Url)
	const data = await storageProover.getProof(tokenAddress, [balanceSlot], blockNumber, true)

	return data;
	const { proof, block, blockHeaderRLP, accountProofRLP, storageProofsRLP } = data
        console.log(data);	
}

async function do_challange(bbjPbk, ethAddress) {
    const storageProof = getStorageProof(ethAddress);
    const root = rollupContract.nullifiersRoot();

    let input = await roll.smtKeyExists(bbjPbk);
    let proof = await snarkjs.groth16.fullProve(input,smtKeyExistsWasmFile,smtKeyExistsZkeyFile/*, new logger()*/ );
    let callData = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    console.log("sending rollup tx...");
    let tx = await rollupContract.challange(
	ethAddress,
	storageProof.blockHeaderRLP,
	storageProof.accountProofRLP,
	storageProof.storageProofsRLP[0],
	[ proof.proof.pi_a[0], proof.proof.pi_a[1] ],
	[ [proof.proof.pi_b[0][1],proof.proof.pi_b[0][0]],[proof.proof.pi_b[1][1],proof.proof.pi_b[1][0]] ],
	[ proof.proof.pi_c[0], proof.proof.pi_c[1] ],
    );

    let res = await tx.wait();
    console.log("challange tx mined");
}
/*
async function checker() {	
	rollupContract.on("Voted", (voters) => {
		// check that voters are ok
		for (let n=0;n<voters.length;n++) {
			// check if contains tokens
			const ethAddress = await rollupContract.keys(voters[n]);
			let challange = false;
			if (ethAddress=="0x0000000000000000000000000000000000000000") {
				challange = true;
			} else {
				if (await erc20token.balanceOf(ethAddress) == 0) {
					challange = true;
				}
			}
			if (challange) {
			
			}
		}
	})
}
*/
async function start() {
	
	//await getStorageProof(wallet.address);
	if (rollupContract === undefined ) {
		await do_deploy();
	}
	const c2 = new ethers.Contract(rollupContract.address,VoteRollup.abi, wallet2);
	const c3 = new ethers.Contract(rollupContract.address,VoteRollup.abi, wallet3);
	const r1 = await rollupContract.registerVoter(b256(vote1.votePbkAx));
	const r2 = await c2.registerVoter(b256(vote2.votePbkAx));
	const r3 = await c3.registerVoter(b256(vote3.votePbkAx));
        await r1.wait();
	await r2.wait();
	await r3.wait();

	await do_rollup([vote1,vote2]);
	await do_rollup([vote3]);
	console.log("result=",await rollupContract.result());
	console.log("count=",await rollupContract.count());

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

(async () => {
    try {
        await start();
    } catch (e) {
        console.log(e);
    }
})();
