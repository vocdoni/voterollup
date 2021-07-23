import { Voter }  from '../../../../circuit/lib/rollup';
import { ethers } from "ethers";
import VoteRollup from '../../../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json';

const erc20abi = `[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint256"}],"name":"burn","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"standard","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_value","type":"uint256"}],"name":"burnFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"},{"name":"_extraData","type":"bytes"}],"name":"approveAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"}]`

async function component() {
  
  /* check if we are registered */
  let serverInfo;
  try {
  	serverInfo = await ethers.utils.fetchJson("http://localhost:9001/info");
 } catch (error) {
	console.log(error);
  	alert("Server is not available");
  	return;
  }
 
  let rollupAddress = serverInfo.address;
  let tokenAddress = serverInfo.token;
  let tokenBlockNumber = serverInfo.block;
  let chainId = serverInfo.chainId; 
  
  try {
    const accounts = await ethereum.send('eth_requestAccounts');
  } catch (error) {
     console.log("ERROR", error);
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  if ((await provider.getNetwork()).chainId != chainId ) {
  	alert("please, use chainId "+chainId);
	return;
  }

  const signer =  provider.getSigner();
  const rollup = new ethers.Contract(rollupAddress, VoteRollup.abi , signer);
  const erc20 = new ethers.Contract(tokenAddress, erc20abi, signer);
  const erc20symbol = await erc20.symbol();
  const balance = await erc20.balanceOf(signer.getAddress());
  alert(
	  "WELCOME TO BINDNING VOTE PoC" +
	  "\nRollup:"+rollupAddress+
	  "\nToken:"+erc20symbol+" @ "+tokenBlockNumber+
	  "\nbalance="+balance+
	  "\nchainId="+chainId
  );
 
  const userBbjPbk = await rollup.keys(signer.getAddress());
  const signature = await signer.signMessage("This signature is used to derive a private key for the binding vote, do not sign any message like this in another web site that is not https://test.binding.aragon.org");
  let voter = new Voter(signature.substr(2,64));
  if (userBbjPbk == 0) {
 	alert("User is not registered the voting key, registering it now"); 
	let tx = await rollup.registerVoter(voter.key.pbk.x);
	alert("Waiting for tx "+tx.hash);
	await tx.wait();
 	alert("You have sucessfully registered your key :)"); 
  } else {
	// Sanity check
	if (BigInt(voter.key.pbk.x) != BigInt(userBbjPbk)) {
		alert("ERROR: The registered key is not the derivated key");
		return;
	}
  }
  const choice = BigInt(parseInt(prompt("Your vote, please")));
  let vote = voter.vote(choice);
  console.log(vote);


}


await component();

