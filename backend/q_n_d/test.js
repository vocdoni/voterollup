const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract } = require('./server-lib');

async function start() {
	const server = new RollupServer(
		"https://rinkeby.vocdoni.net",
		"0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d",
		function(...args) { console.log("🥞", ...args); }
	);
	await server.deploy("0x81A99588B326679E2fbc2768F81622B62ed70033",0);

	const wallet2 = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976e", server.provider)    
	const wallet3 = new ethers.Wallet("0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976f", server.provider)    

	let vote1 = {
	  address: server.wallet.address,
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

	const c2 = new ethers.Contract(server.rollupContract.address,VoteRollupContract.abi, wallet2);
	const c3 = new ethers.Contract(server.rollupContract.address,VoteRollupContract.abi, wallet3);
	
	console.log("[TEST] registering voters...");
	const r1 = await server.rollupContract.registerVoter(server.b256(vote1.votePbkAx));
	const r2 = await c2.registerVoter(server.b256(vote2.votePbkAx));
	const r3 = await c3.registerVoter(server.b256(vote3.votePbkAx));
        await r1.wait();
	await r2.wait();
	await r3.wait();

	const watchdog = new RollupServer(
		"https://rinkeby.vocdoni.net",
		"0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d",
		function(...args) { console.log("🐕", ...args); }
	);
	await watchdog.attach(server.rollupContract.address);
	await watchdog.startListenAndChallange();
	
	await server.rollup([vote1]);
	await server.rollup([vote2]);
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
