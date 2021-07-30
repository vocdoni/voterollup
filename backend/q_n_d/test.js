const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract, RegistryContract } = require('./server-lib');
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

 	// 0x3E311B4D335E3Dc1F820366c12C1baDD3e193E12
	// 1891156797631087029347893674931101305929404954783323547727418062433377377293
	const voter1 = new Voter("0000000000000000000000000000000000000000000000000000000000000001");

	// 16854128582118251237945641311188171779416930415987436835484678881513179891664
	// 0x9642fAbEcdf4a9BEbcc68B3BB3077974428ce176
	const voter2 = new Voter("0000000000000000000000000000000000000000000000000000000000000002");
	
	// 17184842423611758403179882610130949267222244268337186431253958700190046948852
	// 0xf5B743909D9CA2548679104C5646D8624D9bFa
	const voter3 = new Voter("0000000000000000000000000000000000000000000000000000000000000003");

	// 1490516688743074134051356933225925590384196958316705484247698997141718773914n
	// not registred
	const voter4 = new Voter("0000000000000000000000000000000000000000000000000000000000000004");


	/*	
	await server.deployRegistry();
	const wallet1 = new ethers.Wallet(PVK1, server.provider);    
	const wallet2 = new ethers.Wallet(PVK2, server.provider);   
	const wallet3 = new ethers.Wallet(PVK3, server.provider);

	const c1 = new ethers.Contract(server.registryContract.address,RegistryContract.abi, wallet1);
	const c2 = new ethers.Contract(server.registryContract.address,RegistryContract.abi, wallet2);
	const c3 = new ethers.Contract(server.registryContract.address,RegistryContract.abi, wallet3);
	
	console.log("[TEST] registering voters, and starting... ", vote1.votePbkAx);
	const r1 = await c1.register(server.b256(vote1.votePbkAx));
	const r2 = await c2.register(server.b256(vote2.votePbkAx));
	const r3 = await c3.register(server.b256(vote3.votePbkAx));
        await r1.wait();
	await r2.wait();
	await r3.wait();
	console.log("[TEST] voters registered.");
	
	
	await server.deployVoting(server.registryContract.address, TOKEN_ADDR, TOKEN_SLOT);
	*/

	// await server.deployVoting("0x4D48691a887Bd6e1E2D4311cdDe506A4cCA2690C");
	await server.attach("0xfddf6F0B615180374fd25ab25a10eD28D9a07eE1");
	console.log(await server.start(TOKEN_ADDR, TOKEN_SLOT));

	let vote1 = voter1.vote(BigInt(server.votingId), 1n);
	let vote2 = voter2.vote(BigInt(server.votingId), 2n);
	let vote3 = voter3.vote(BigInt(server.votingId), 3n);
	let vote4 = voter4.vote(BigInt(server.votingId), 4n);
	
	const watchdog = new RollupServer(
		WEB3_URL, PVK1,
		function(...args) { console.log("🐕", ...args); }
	);
	await watchdog.attach(server.rollupContract.address);
	await watchdog.attachVotingId(server.votingId, server.tokenAddress, server.tokenSlot, server.tokenBlockNumber, server.tokenBlockHash);
	await watchdog.startListenAndChallange();
	
	await server.rollup([vote4]);
	//await server.rollup([vote1]);
	let voting = await server.rollupContract.votings(server.votingId); 
	console.log("result=",voting.result);
	await new Promise(r => setTimeout(r, 100000));

}

(async () => {
    try {
        await start();
    } catch (e) {
        console.log(e);
    }
})();
