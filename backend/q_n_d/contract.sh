cd ../../contract
npx hardhat clean
npx hardhat compile
cd ../backend/q_n_d
node test 2> /dev/null

