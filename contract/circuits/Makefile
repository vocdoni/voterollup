SNARKJS=../node_modules/.bin/snarkjs 
CIRCOM=../node_modules/.bin/circom 
BUILD=build
RELEASE=release

# to compile big circuits
# check https://github.com/hermeznetwork/phase2ceremony_4/blob/main/VERIFY.md
# HUGENODE=~/node/out/Release/node --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 --expose-gc
# CIRCOM=$(HUGENODE) ~/circom/cli.js
# SNARKJS=$(HUGENODE) ../node_modules/snarkjs/cli.js

all: $(RELEASE)/rollup.wasm \
     $(RELEASE)/rollup.zkey \
     $(RELEASE)/rollup.sol \
     $(RELEASE)/smtkeyexists.wasm \
     $(RELEASE)/smtkeyexists.zkey \
     $(RELEASE)/smtkeyexists.sol 

$(BUILD):
	mkdir $(BUILD)

$(RELEASE):
	mkdir $(RELEASE)

$(RELEASE)/rollup.zkey $(RELEASE)/rollup.sol: $(BUILD)/ $(BUILD)/rollup.r1cs $(BUILD)/pot_final.ptau
	$(SNARKJS) zkey new $(BUILD)/rollup.r1cs $(BUILD)/pot_final.ptau $(BUILD)/rollup_0000.zkey
	$(SNARKJS) zkey contribute $(BUILD)/rollup_0000.zkey $(BUILD)/rollup_0001.zkey --name=contributor -v -e=random2
#	$(SNARKJS) zkey verify $(BUILD)/rollup.r1cs $(BUILD)/pot_final.ptau $(BUILD)/rollup_0001.zkey
	$(SNARKJS) zkey beacon $(BUILD)/rollup_0001.zkey $(RELEASE)/rollup.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n=Final
#	$(SNARKJS) zkey verify $(BUILD)/rollup.r1cs $(BUILD)/pot_final.ptau $(RELEASE)/rollup.zkey
	$(SNARKJS) zkey export solidityverifier $(RELEASE)/rollup.zkey $(RELEASE)/rollup.sol

$(RELEASE)/rollup.wasm $(BUILD)/rollup.r1cs: $(BUILD) $(RELEASE) rollup.circom
	$(CIRCOM) rollup.circom --r1cs $(BUILD)/rollup.r1cs --wasm $(RELEASE)/rollup.wasm --csource $(RELEASE)/rollup.cpp --sym $(BUILD)/rollup.sym -v

$(RELEASE)/smtkeyexists.zkey $(RELEASE)/smtkeyexists.sol: $(BUILD)/ $(BUILD)/smtkeyexists.r1cs $(BUILD)/pot_final.ptau
	$(SNARKJS) zkey new $(BUILD)/smtkeyexists.r1cs $(BUILD)/pot_final.ptau $(BUILD)/smtkeyexists_0000.zkey
	$(SNARKJS) zkey contribute $(BUILD)/smtkeyexists_0000.zkey $(BUILD)/smtkeyexists_0001.zkey --name=contributor -v -e=random2
#	$(SNARKJS) zkey verify $(BUILD)/smtkeyexists.r1cs $(BUILD)/pot_final.ptau $(BUILD)/smtkeyexists_0001.zkey
	$(SNARKJS) zkey beacon $(BUILD)/smtkeyexists_0001.zkey $(RELEASE)/smtkeyexists.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n=Final
#	$(SNARKJS) zkey verify $(BUILD)/smtkeyexists.r1cs $(BUILD)/pot_final.ptau $(RELEASE)/smtkeyexists.zkey
	$(SNARKJS) zkey export solidityverifier $(RELEASE)/smtkeyexists.zkey $(RELEASE)/smtkeyexists.sol

$(RELEASE)/smtkeyexists.wasm $(BUILD)/smtkeyexists.r1cs: $(BUILD) $(RELEASE) smtkeyexists.circom
	$(CIRCOM) smtkeyexists.circom --r1cs $(BUILD)/smtkeyexists.r1cs --wasm $(RELEASE)/smtkeyexists.wasm --csource $(RELEASE)/smtkeyexists.cpp --sym $(BUILD)/smtkeyexists.sym -v


$(BUILD)/pot_final.ptau: $(BUILD)
	$(SNARKJS) powersoftau new bn128 18 $(BUILD)/pot_0000.ptau -v
	$(SNARKJS) powersoftau contribute $(BUILD)/pot_0000.ptau $(BUILD)/pot_0001.ptau --name=contribution -v -e=random
	$(SNARKJS) powersoftau beacon $(BUILD)/pot_0001.ptau $(BUILD)/pot_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n=Final
	$(SNARKJS) powersoftau prepare phase2 $(BUILD)/pot_beacon.ptau $(BUILD)/pot_final.ptau -v
	$(SNARKJS) powersoftau verify $(BUILD)/pot_final.ptau

clean:
	rm -rf $(BUILD)
