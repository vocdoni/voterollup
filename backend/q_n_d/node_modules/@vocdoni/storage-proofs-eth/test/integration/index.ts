import "mocha" // using @types/mocha
import { expect } from "chai"
import { ERC20Prover } from "../../src/index"
import { provider } from "../util"
import { addCompletionHooks } from "../mocha-hooks"

addCompletionHooks()

describe('Token Storage Proofs', () => {
    let storageProover: ERC20Prover
    let blockNumber: number

    beforeEach(() => {
        storageProover = new ERC20Prover(provider)
    })

    const TOKEN_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7" // Tether
    const BALANCE_MAPPING_SLOT = 2

    it("Should compute a holder's balance slot", () => {
        const data = [
            { addr: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", idx: 1, output: "0x36306db541fd1551fd93a60031e8a8c89d69ddef41d6249f5fdc265dbc8fffa2" },
            { addr: "0x4fa97b031428427ea36B8aDC91D9CB8Ba623F884", idx: 1, output: "0x998248fdc5b7b1d92420008502788c86e9d2075c997efd36254eb498729f099c" },
            { addr: "0x5C3ba3f01CB9Fa7429e7098dd89128b6378b22DE", idx: 1, output: "0x0213953694b427d8f8665bbbc81e58cb9fa05d85f1eb7ee22104c49f9300b40f" },
            { addr: "0xC69Bca872148FaC44a31d1922dd926dea34691F7", idx: 1, output: "0x9942f197e4f58df3c3c91803f59e36320cbb69ef8bd9fad0ca42530dd72532b6" },
            { addr: "0x1F5C3d9956314a5B48BbAb512567582C3FDd4814", idx: 1, output: "0xf4405451b973266bb605a12e1313ae240c8439c378025b544dce0e34e647691e" },
            { addr: "0xB9dCe9de05459a24294406a36D925869C4593b8A", idx: 1, output: "0x9420d1514c615c08c9665f50b7358e806e34c12e09ec3933d6b0dde95121ba6b" },
            { addr: "0x27271634805ADf966CD287157d643F0e7b41767a", idx: 1, output: "0x3221764d0ceea698a12be8ae8a2600d0e3bb26cad5d862c12f641f4831e1f804" },
            { addr: "0x19d1c7de23afC63a61aaf070187D6Fb8c243C64d", idx: 1, output: "0x360835ceba0d2e3baff887c2b7315a24a2bcab2701dd8e7c297782bcb314c7eb" },
        ]

        for (let item of data) {
            expect(ERC20Prover.getHolderBalanceSlot(item.addr, item.idx)).to.eq(item.output)
        }
    })

    it('Should generate valid proofs', async () => {
        const holderAddr = "0x1062a747393198f70f71ec65a582423dba7e5ab3"

        blockNumber = await provider.getBlockNumber()
        const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddr, BALANCE_MAPPING_SLOT)
        const result = await storageProover.getProof(TOKEN_ADDRESS, [balanceSlot], blockNumber, true)

        expect(result.proof).to.be.ok
        expect(Array.isArray(result.proof.accountProof)).to.eq(true)
        expect(result.proof.balance).to.match(/^0x[0-9a-fA-F]+$/)
        expect(result.proof.codeHash).to.match(/^0x[0-9a-fA-F]+$/)
        expect(result.proof.nonce).to.match(/^0x[0-9a-fA-F]+$/)
        expect(result.proof.storageHash).to.match(/^0x[0-9a-fA-F]+$/)
        expect(typeof result.proof.storageProof).to.eq("object")
        expect(result.blockHeaderRLP).to.match(/^0x[0-9a-fA-F]+$/)
        expect(result.accountProofRLP).to.match(/^0x[0-9a-fA-F]+$/)
        result.storageProofsRLP.forEach(proof => {
            expect(proof).to.match(/^0x[0-9a-fA-F]+$/)
        })
    }).timeout(10000)

    it('Should verify a proof', async () => {
        const storageRoot = "0x67112e931a0e90f399d3b9b87c217df4410731395ef90649692199c676b62fb0"
        const storageProof = {
            "key": "0xbb68a47d5da9c117ae8a139bc647ecaad9137bf7b80cc87b8140d70ce9ff7b69",
            "value": "0x1312d00",
            "proof": [
                "0xf90211a00c12386d091b85c4e30df2532d45e466a03a03a4ff491aaef3ccb5cd149cd57da04dbb408692f8d72fb508efb8a3ed80a4e6b45c2bb5760cf8ac9a8cdbdc1a952fa069f41829e016a10c661c89930e2333d89a2a4e3a7bad40ffe5c976388d2a9c5ea079f8d9fc1b7be70e788668480ea41192e5349ab47d2fcfb3d5d9b8ba4eac5248a03d450371a557dcd23a489a32b3a8c3ad53554e7583df4288b16551b07835ced5a03db7d966bfe47a930de10bae752494af0552fcc033022741bea4d84ea298b110a0a49b1b032b3bf1804a0f000b74ffb35a6b0ea5995a1d1c7174e8931bac6ec409a0bc91c9c620f574c33ec91dcceab418b0ba52350b22d9bde76a96244e115ea44aa0bd4ca3b952b6c8fa420844c88f06b888352b42ec2c9779ad27a297f32af96369a02bcd5dfffa276ad3254fbf8be2f042e502da17fdef140fe978b83422ec5b8d39a014ac089db39aac280d81b1318352bc989a5109f8c3bfe67e0cda31429efd6981a0046147b0e19c7a5eb4bfcfe1c6631cac75d994f785aa320106ea8aee1eeb5514a0458b5b0b6e9ec7ab9a1df0003c752bb8122f94e50f76b673e1e445f755664eb0a067c772e3976bba2209678e0f7b6cde45679aea931808cb036ada7af01c5e2bc4a03becb72d6dbcc85048a04e4d20707c7c37223ddb0de61bf0ef083bcc85a9ebcea0e4ea0d2bb338e6d57c637d7cb697500ea6a1a34c60fe8001b12f2a234d856f9480",
                "0xf90211a065341d93555afdd0217f1c338f5aa443a8792662ae2a258871befa736955de0ca07856ef690449c0231160b644b3256d9e82e648967382bd3c994f1aad45d62aeea0a37699d0fd0d69e91336434435ba34cf211f78a0c608b2f005f7c232145253dfa08d8882be60bd729ffca6c3fb1b119bc74e2cda7ec58f0971a70ac2f72b17c900a0ba7a2e7f128d49df69c9bc1158b9397ce23ae4646847db1a24e8b3f99963f813a07abdcbcbd3d5cda6669f3a10e6c78fc7e4c91ba50a94347528876a37fac1df85a0d97c97cd1e6b14307cda315f09a85693206b17f7af624e12317b866bbdd1a6eea0cddd2ca612c774f9ac9c092954259875a4416e449796f7bbaed19b3ed91c55e0a01a5b8fbfd64ef02765dddccb936c008c7cce9d4516efe11e1bcc268471f176f4a035af58b02ef1deb9c957185702a4fcfabfc89e066579495a91be1535e6475840a05c4deb2f0757266ed832491f01132a03f65b41db443a851cb7abde598e1f9475a08b5e49a5449aca02d1a2fdaa562460e98915cd4a9de54a3e50f70491559db72da02f22086f8be2c7df33fe154158af84cd9528e4d56d1e74b1053e5701ac6abc3ea01d11c95deb1d51fc701e430ceeb5de2e1fdbf420635677f25ac9dd44d6057bf3a049c5f66037614513712c5ddd8f4f8d4103373df87662b662faade97806e4261fa0097f905533700da4f8c827c50bc9f6b719c83ad246baf3a66adccc0808c7348d80",
                "0xf90211a0467fce1a3f0779f59ed94a849980c18e327e652d1b9c19f518e58554f26363b8a0e7ef690a832eedf1ee714aa1289c2988a51788ec02edced42c75e657e9e612f3a0d6ad2e6bb1ae8a8c04cd18a71b7f3548fa3243f81f98dc8233a29de59b37cb04a0000eebb6b4d3f81864278b247967c635529d4274783ec57877087244de548445a0c1086820607c73ba05fbf874850da94ea0f60f7e630d79f72da59f130363d417a073702f2cc8d142c7303e3c939d1fe1ef5b866a051050f26baa6133d91642e825a0a7022e1a428aabaf5fbd263ad840527ca8618d2790040d88f9c492d9455ac4d0a09c7c35628e68364eb7c46d8a2a5bfe0fe27266dcb4b4e1953f6da30871d1b33aa0cd432b12643e5c58c3bb7c5a8f25bf616277782bd5ab9f7b5e171ba073362cd5a0ff38da3d9fefd0f3a77b963c32fd98f763150791c12e6f8ace530861e34c3574a0510456b405120dc4146bc48f5150808fe3782ad158654d34555aab85b4ba854ba011758e71f5be7b4735cfaf33da8ecfa3ac31630a71ebbd4791b9322165d8869aa0b637d0b6aadd6ddb365c8c56728c9c81a440a58ba4a155471cff16ccd18a356ca094960672cae65405a1b49a5775e92c6e76d0f23cf9b259cf57ce084a90f9e015a0caedec354cf68c91841dd4e884eded1cfab242e28c10a4d9d23b5d51401c5e2da04babacccdc2c40cbcf466e8c07104f66785211c3d3b8cc3a57700c6fc838b93c80",
                "0xf90211a0f35c4394590c86a1d4cb36d0491cc45e5940cbcc048d1be43f212b800d715b17a0ad113dade0ad42918903cc1ad3bf4f2f34d609087a0370275f64a6aeccc48d60a0d671641ff4dd0077dba20ed8d0faa7a71c2c5c6c41077e2d97e500d37f11db4ca071e5b1e12caf9b1dbb18daeeb69eef67729dbe5a0dac8cae73eaab60bac6dbf6a0366d87ffefc528c51f3782b967aaf884bbae8801526357ebc41a7bd4998d535ea0bdeb3134bddac3647e535401e393e9c8609fbf0dce7e21ece2323de453c53acfa059dda4cd4f09cc9cd1ce03c9263565562f76c3a288f3b2ae9784b65db94f0c1aa02a574b3145f0b5cf7e7925f1ab0947631e85e8f91a1814a32d24ab9c23dff58ea0c7c07c3301587bec4b26e37f9e438a48cd53c0491ab3f09ac5899133e219c153a0301ae6d3990e49af5b3cf9ae73a593e7c158de8ee6d2b96a179b919e675a1deca00deec05e05d1bab41160f3d140be68692c1035dfeabf9eb8bd00cb83d45406ffa0c99d5ac0c4b4eb78d1d52749812c313a3429d7dc97690a52825360f695b7d527a0f102df1ef5c085b42a884c2886a39d92807540f5a988ca3a6c791f91bb2fed92a0fd95781d11300fcba2210db9b3a68e64dc1ae74ac0b294c7492e22b37780d01aa00165102edd039bdfa88b46787871f36abf4535397d6663a16833ae21e654fd73a0d41e67eec1b1df5f4c7d4e0bbfe3e3e591367fb3dc449730f81c5a6b1475376e80",
                "0xf901b1a0f5fe7f22f179ed8b0a43d6475812bd4c3a54fef06fcb264e3ab6a17428392257a058aa04fa7a40687f6bd94396338da8b0cf98e72ed78e207519d8d0da51cbf47da0db28fff1b4a7f6da752d048941a73f3f3c000b081aefd2b8ca71ded7530a2c34a018b2a07e748b1628efcee915a4cdbb66c43b6842ce18a348aaf0722804078812a079261f3df78ce0f52929dea38175f03b695ab82b159a079a6c668d1e5b26882aa04125eaf9cf377c20c6c710747ccd60d4671dc2180bab3ab19ac7cb1eeb91d8788080a027fadb7e168e0fbe94b41936983bf8dbf6d552db358a140302ab07f965e7d2e880a0d76876fe32ec9777cc1b4deff2866418b47f6f3620f139d5e52053acb2881a64a0acf871b77c04ede4b0ec90e463570bc691ede0b38c818c00b68e460bab57edeaa0fc02d66e10f237a17b7d4075423f9e2edb3d784f48cd96cb021f329647cbd657a0a15bc966a929651faae3ab83e62a9cd1f6307fd8791ec529cbcb744dfb8184eba097f67873ac18ac623205ca8ee8da43fd9779110b8ad4b4c1b56634a4b55c18e3a03ddb79bb5c94526d8259df5dbaf32bef8b44966d0f87ab4512a75b31247f208180",
                "0xf871808080a0e223f84836f50d4d77979eafc01c0de9fb0bc4f4b8b9db6c81777cc48ddbdde380a0e7ac2a9defb162ca10febf20c738c7f34685260b8fb23e9f13fef654350d813f80808080808080a0c425e2a84a822a2be053bc9e344a35084df3eef13ee86c6f144c7ef6d7f6db67808080",
                "0xe59e20065c06fe4702946a5cd3b0b790acd1df3bee304a795e85862ba4d8157a858401312d00"
            ]
        }

        const valid = await storageProover["verifyStorageProof"](storageRoot, storageProof)

        expect(valid).to.eq(true)
    }).timeout(10000)

    it('Should proof that a value does exist', async () => {
        const holderAddress = "0x1062a747393198f70f71ec65a582423dba7e5ab3"

        const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, BALANCE_MAPPING_SLOT)
        const storageKeys = [balanceSlot]
        const { proof } = await storageProover.getProof(TOKEN_ADDRESS, storageKeys, "latest", true)
        expect(proof.storageProof[0].value).to.not.eq("0x0")
    }).timeout(10000)

    it('Should verify a proof of non-existence', async () => {
        const holderAddress = "0x0010000000000000000000000000000000000000"
        const tokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"

        const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, 100)
        const storageKeys = [balanceSlot]

        const { proof, block } = await storageProover.getProof(tokenAddress, storageKeys, "latest", true)
        expect(proof.storageProof[0].value).to.eq("0x0")

        await storageProover.verify(block.stateRoot, tokenAddress, proof)
    }).timeout(10000)

    it('Should fail verifying if some value has been tampered', async () => {
        const holderAddress = "0x0010000000000000000000000000000000000000"
        const tokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
        const unrealBalanceMappingPosition = 100

        const balanceSlot = ERC20Prover.getHolderBalanceSlot(holderAddress, unrealBalanceMappingPosition)
        const storageKeys = [balanceSlot]

        {
            const { proof, block } = await storageProover.getProof(tokenAddress, storageKeys, "latest", true)
            expect(proof.storageProof[0].value).to.eq("0x0")

            // Corrupt the proof
            block.stateRoot = "0x0011223344556677889900003b11fd580a50d3054c144ca7caa623f29073d39d"

            try {
                await storageProover.verify(block.stateRoot, tokenAddress, proof)
                throw new Error("Should have failed but didn't")
            } catch (err) {
                expect(err.message).to.not.eq("Should have failed but didn't")
            }
        }

        // 2
        // TODO: The library should be throwing an error, but doesn't

        // {
        //     const { proof, block } = await storageProover.getProof(tokenAddress, storageKeys, "latest", true)
        //     expect(proof.storageProof[0].value).to.eq("0x0")

        //     // Corrupt the proof
        //     proof.storageProof[0].proof = []

        //     try {
        //         await storageProover.verify(block.stateRoot, tokenAddress, proof)
        //         throw new Error("Should have failed but didn't")
        //     } catch (err) {
        //         expect(err.message).to.not.eq("Should have failed but didn't")
        //     }
        // }
    }).timeout(10000)
})
