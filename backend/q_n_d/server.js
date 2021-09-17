const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const PORT = 9001;
const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract } = require('./server-lib');

// const REGISTRY_ADDR = "0x";
// const ROLLUP_ADDR = "0x";

const WEB3URL = "https://";
const ACCOUNT_PVK = "0x";
const TOKEN_ADDR = "0x";
const TOKEN_SLOT = 0;

const QUEUE_SIZE = 1;
let queue = []

async function serve_api(server) {
	let apiRouter = express.Router();
	apiRouter.get('/info', async (req, res, next)=>{
    	try {
		info = {
			address : server.rollupContract.address,
			chainId : (await server.provider.getNetwork()).chainId,
			votingId : server.votingId,
			tokenAddress : server.tokenAddress,
			tokenBlockNumber : server.tokenBlockNumber
		};
        	res.status(200).json(info);
	} catch(e) { 
       		console.log(e);
        	res.sendStatus(500);
	}});

	apiRouter.post('/vote', async (req, res, next)=>{
    	try {
		let vote = {
			votePbkAx: BigInt(req.body.votePbkAx),
			votePbkAy: BigInt(req.body.votePbkAy),
			voteSigS: BigInt(req.body.voteSigS),
			voteSigR8x: BigInt(req.body.voteSigR8x),
			voteSigR8y: BigInt(req.body.voteSigR8y),
			voteValue: BigInt(req.body.voteValue),
			voteElectionId: BigInt(req.body.voteElectionId)
		};
		queue.push(vote);
		if (queue.length >= QUEUE_SIZE) {
			await server.rollup(queue);
			queue = [];
			res.status(200).json("your vote has been added");

		} else {
			res.status(200).json("your vote is in the batch queue");
		}
	} catch(e) { 
       		console.log(e);
        	res.sendStatus(500);
	}});

	app.use(bodyParser.json());
	app.use(cors());
	app.use(morgan('dev'));
	app.use('/',apiRouter)

	app.listen(PORT, ()=>{
    		console.log(`server is listening  on ${PORT}`);
	});

}

async function start_watchdog(server) {
	const watchdog = new RollupServer(
		WEB3URL, ACCOUNT_PVK,
		function(...args) { console.log("🐕",...args) }
	);
	await watchdog.attach(server.rollupContract.address);
	await watchdog.attachVotingId(server.votingId, server.tokenAddress, server.tokenSlot, server.tokenBlockNumber, server.tokenBlockHash);
	await watchdog.startListenAndChallange();
}

async function start() {
	const server = new RollupServer(WEB3URL,ACCOUNT_PVK);
	if (typeof REGISTRY_ADDR === 'undefined' ) {
		await server.deployRegistry();
		REGISTRY_ADDR = server.registryContract.address;
	}
	if (typeof ROLLUP_ADDR === 'undefined' ) {
		await server.deployVoting(REGISTRY_ADDR);
		ROLLUP_ADDR = server.rollupContract.address;
	} else {
		await server.attach(ROLLUP_ADDR);
	}
	await server.start(TOKEN_ADDR, TOKEN_SLOT);

	await start_watchdog(server);
	await serve_api(server); 

}

(async () => {
    try {
        await start();
    } catch (e) {
        console.log(e);
    }
})();
