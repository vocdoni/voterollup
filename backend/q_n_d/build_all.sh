# compile the circuit
cd ../../circuit
npm test
cd ../contract/circuits
rm -rf release
make

# compile the contracts
cd ..
npx hardhat clean
npx hardhat compile
cd ../backend/q_n_d

# create the binary prover
CIRCUITS=../../contract/circuits/release

CXX=g++
CXXFLAGS="-pthread -lgmp -std=c++14 -O3"
SOURCES="prover/circom_runtime/c/main.cpp prover/circom_runtime/c/calcwit.cpp prover/circom_runtime/c/utils.cpp prover/rapidsnark/build/fr.cpp prover/rapidsnark/build/fr.o"
INCLUDE="-I prover/circom_runtime/c -I prover/rapidsnark/build -I prover"

#$CXX $SOURCES $CIRCUITS/rollup.cpp $INCLUDE $CXXFLAGS -o prover/rollup
$CXX $SOURCES $CIRCUITS/smtkeyexists.cpp $INCLUDE $CXXFLAGS -o prover/smtkeyexists

cp $CIRCUITS/rollup.dat prover
cp $CIRCUITS/smtkeyexists.dat prover

# do whatever
node test

