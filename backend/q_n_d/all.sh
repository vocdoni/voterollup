cd ../../circuit
npm test
cd ../contract/circuits
rm -rf release
make
cd ..
npx hardhat clean
npx hardhat compile
cd ../backend/q_n_d
node server.js

