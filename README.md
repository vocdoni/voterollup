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
