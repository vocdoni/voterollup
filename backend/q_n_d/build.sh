CIRCUITS=../../contract/circuits/release

CXX=g++
CXXFLAGS="-pthread -lgmp -std=c++14 -O3" 
SOURCES="prover/circom_runtime/c/main.cpp prover/circom_runtime/c/calcwit.cpp prover/circom_runtime/c/utils.cpp prover/rapidsnark/build/fr.cpp prover/rapidsnark/build/fr.o" 
INCLUDE="-I prover/circom_runtime/c -I prover/rapidsnark/build -I prover"

#$CXX $SOURCES $CIRCUITS/rollup.cpp $INCLUDE $CXXFLAGS -o prover/rollup
$CXX $SOURCES $CIRCUITS/smtkeyexists.cpp $INCLUDE $CXXFLAGS -o prover/smtkeyexists

cp $CIRCUITS/rollup.dat $CIRCUITS/rollup.zkey prover
cp $CIRCUITS/smtkeyexists.dat $CIRCUITS/smtkeyexists.zkey prover

