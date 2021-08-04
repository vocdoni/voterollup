## How to build the project


- install `nvm`, run `nvm use 16`
- go to `circuits` folder && run `npm i`
- go to `contracts` folder && run `npm i`
- go to `contracts/circuits` folder
  - uncomment all makefile comments `#`
  - run `make`, wait some hours
- create folder `backend/q_n_d/prover` and from there
  - `git clone https://github.com/iden3/rapidsnark`, compile the project, see its readme
  - `git clone https://github.com/iden3/circom_runtime`
  - `mkdir nlohmann && wget https://github.com/nlohmann/json/releases/download/v3.9.1/json.hpp -O  nlohmann/json.hpp`
- go to `backend/q_n_d/node_modules/@vocdoni/storage-proofs-eth`
  - run `npm i`
  - run `npm run build`
- go to `backend/q_n_d`
  - run `npm i`
  - run `build_all.sh`

## How to run the server

- first run the test from `backend/q_n_d` 
  node test.js
- import private key accounts in that appears in `test.js`
- in parallel
	- in `backend/q_n_d` run `node server`
 	- in `backend/q_n_d/client` run `node run serve`


## Performance notes

### constrains measures

```
proofs  levels  constrains  time   mem
  4     10      200000      15s    1 973 660 824
  5     10      241000      18s    2 055 015 640
  6     10      253047      19s    2 116 411 928
  7     10      294739      22s    2 320 870 176
  8     10      306957      23s    2 617 070 272
  9     10      348649      26s    3 130 714 776
 10.    10      360867      27s    3 294 839 152
 12     10      598899      33s    3 559 340 064
 14.    10      468687      44s    3 791 002 720

  1.    2.      129017

  4.    4.      187161
  8.    4.      283005
 16.    4.      471133
 20.    4       570537
 32.    4.      858069

  4.    8.      193569
  4.   16       209569
  4.   32       243049
  4.   64.      306921

 20.   64      1169337

306921  - 129017 =  177900 / 4 = 44.4
1169337 - 129017 = 1040000 /20 = 52
```

### gas costs

```
KISS votation 
 vote-1st         66,629 
 vote-next        24,004

registry
  deploy         258,536
  register        68,956

voting
  deploy       6,673,159
  new voting.     25,989
  rollup         291,801
  challange-1    574,574
  challange-2    908,822
```

```     
contract KISSVoting {
    mapping (bytes32=>bool)    voted;
    mapping (bytes32=>uint256) results;

    function vote(uint256 votingId, uint256 option) external {
        bytes32 voteId = keccak256(abi.encodePacked(votingId, msg.sender));
        require(!voted[voteId]);
        results[keccak256(abi.encodePacked(votingId,option))] += 1;
        voted[voteId] = true;
    }
}
```


### CPU/RAM Power costs

```
1M constrains => 6 GB RAM

machine with 32 GB RAM:
    about 5MConstrains
        5M / 50Kper64levels => 100 batch size chance 10^20 of collision
        100 votes * 24kGas => 2.4M Gas vs 291k gas is 12% of gas
```

