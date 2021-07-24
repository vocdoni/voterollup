import { Voter }  from '../../../../circuit/lib/rollup';
import { ethers } from "ethers";
import VoteRollupContract from '../../../../contract/artifacts/contracts/VoteRollup.sol/VoteRollup.json';
import ERC20ContractABI from '../../erc20.abi.json';

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
  const rollup = new ethers.Contract(rollupAddress, VoteRollupContract.abi , signer);
 
  const challanged = await rollup.challanged();
  if (challanged) {
  	alert("The votation has been challanged. bye.");
	return;
  }

  const tokenAddress = await rollup.tokenAddress();

  const tokenBlockNumber= await rollup.blockNumber();
  const voteCount = await rollup.count();
  const voteResult = await rollup.result();
  const erc20 = new ethers.Contract(tokenAddress, ERC20ContractABI, signer);
  const erc20symbol = await erc20.symbol();
  const balance = await erc20.balanceOf(signer.getAddress());
  alert(
	  "WELCOME TO BINDNING VOTE PoC" +
	  "\nRollup:"+rollupAddress+
	  "\nToken:"+erc20symbol+" @ "+tokenBlockNumber+
	  "\nbalance="+balance+
	  "\nchainId="+chainId+
	  "\nvoteCount="+voteCount+
	  "\nvoteResult="+voteResult
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
  let vote = await voter.vote(choice);
  vote.address = await signer.getAddress();
  vote = JSON.stringify(vote, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
  );
   let res = await ethers.utils.fetchJson("http://localhost:9001/vote", vote);
   alert(res);
}


await component();

