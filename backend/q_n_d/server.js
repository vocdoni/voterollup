const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const PORT = 8080;
const { ethers } = require("ethers"); 
const { RollupServer , VoteRollupContract } = require('./server-lib');

async function start() {
	const server = new RollupServer(
		"https://rinkeby.vocdoni.net",
		"0xb2bb17da3946e4267cd191dc4b601fcec9143b0902a826da589ae7bc6e4a976d",
		"0x81A99588B326679E2fbc2768F81622B62ed70033",
		0,
		8959397
	);
	await server.deploy();
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
