const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract } = require('./server-lib');
const { Voter } = require('../../circuit/lib/rollup');

const WEB3_URL = "https://rinkeby.vocdoni.net"; 
const PVK1 = "0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d"; // must have tokens
const PVK2 = "0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976e"; // must have tokens
const PVK3 = "0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976f"; // should not have tokens
const TOKEN_ADDR = "0x81A99588B326679E2fbc2768F81622B62ed70033";
const TOKEN_SLOT = 0;

async function start() {
	const server = new RollupServer(WEB3_URL, PVK1,
		function(...args) { console.log("🥞", ...args); }
	);
	await server.deploy(TOKEN_ADDR, TOKEN_SLOT);

	const wallet1 = new ethers.Wallet(PVK1, server.provider);    
	const wallet2 = new ethers.Wallet(PVK2, server.provider);   
	const wallet3 = new ethers.Wallet(PVK3, server.provider);  
	const voter1 = new Voter("0000000000000000000000000000000000000000000000000000000000000001");
	const voter2 = new Voter("0000000000000000000000000000000000000000000000000000000000000002");
	const voter3 = new Voter("0000000000000000000000000000000000000000000000000000000000000003");

	let vote1 = voter1.vote(1n);
	vote1.address = wallet1.address;

	let vote2 = voter2.vote(2n);
	vote2.address = wallet2.address;

	let vote3 = voter3.vote(3n);
	vote3.address = wallet3.address;

	const c1 = new ethers.Contract(server.rollupContract.address,VoteRollupContract.abi, wallet1);
	const c2 = new ethers.Contract(server.rollupContract.address,VoteRollupContract.abi, wallet2);
	const c3 = new ethers.Contract(server.rollupContract.address,VoteRollupContract.abi, wallet3);
	
	console.log("[TEST] registering voters...");
	const r1 = await c1.registerVoter(server.b256(vote1.votePbkAx));
	const r2 = await c2.registerVoter(server.b256(vote2.votePbkAx));
	const r3 = await c3.registerVoter(server.b256(vote3.votePbkAx));
        await r1.wait();
	await r2.wait();
	await r3.wait();

	const watchdog = new RollupServer(
		WEB3_URL, PVK1,
		function(...args) { console.log("🐕", ...args); }
	);
	await watchdog.attach(server.rollupContract.address);
	await watchdog.startListenAndChallange();
	
	await server.rollup([vote1]);
	await server.rollup([vote3]);
	console.log("result=",Number(await server.rollupContract.result()));
	console.log("count=",Number(await server.rollupContract.count()));
}

(async () => {
    try {
        await start();
    } catch (e) {
        console.log(e);
    }
})();
