const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const PORT = 9001;
const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract } = require('./server-lib');

const WEB3URL = "https://rinkeby.vocdoni.net";
const ACCOUNT_PVK = "0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d";

const QUEUE_SIZE = 1;
let queue = []

async function serve_api(address) {
	const server = new RollupServer(
		WEB3URL,ACCOUNT_PVK,
		function(...args) { console.log("🥞",...args) }
	);
        await server.attach(address);
	let apiRouter = express.Router();
	apiRouter.get('/info', async (req, res, next)=>{
    	try {
		info = {
			address : server.rollupContract.address,
			chainId : (await server.provider.getNetwork()).chainId
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
			address : req.body.address,
		};
		queue.push(vote);
		if (queue.length >= QUEUE_SIZE) {
			await server.rollup(queue);
			queue = [];				      res.status(200).json("your vote has been added");

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

async function start_watchdog(address) {
	const server = new RollupServer(
		WEB3URL, ACCOUNT_PVK,
		function(...args) { console.log("🐕",...args) }
	);
	await server.attach(address);
        await server.startListenAndChallange();	
}

async function start() {
	const server = new RollupServer(WEB3URL,ACCOUNT_PVK);
	await server.deploy(
		"0x81A99588B326679E2fbc2768F81622B62ed70033",
		0
	);
	await start_watchdog(server.rollupContract.address);
	await serve_api(server.rollupContract.address); 

}

(async () => {
    try {
        await start();
    } catch (e) {
        console.log(e);
    }
})();
