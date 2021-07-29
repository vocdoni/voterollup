import { Wallet, providers } from "ethers"

if (!process.env.WEB3_ENDPOINT && !process.env.INFURA_TOKEN) {
    console.error("Missing JSON RPC parameters")
    process.exit(1)
}

const WEB3_ENDPOINT = process.env.WEB3_ENDPOINT || ("https://mainnet.infura.io/v3/{INFURA_TOKEN}").replace("{INFURA_TOKEN}", process.env.INFURA_TOKEN)


// export const mnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"

export const provider = new providers.JsonRpcProvider(WEB3_ENDPOINT)
// export const provider = new providers.WebSocketProvider(WEB3_ENDPOINT)

// const wallets: Wallet[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => {
//     return Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`).connect(provider)
// })

// const accounts: TestAccount[] = []
// Promise.all(wallets.map(wallet => {
//     return wallet.getAddress().then(address => {
//         accounts.push({
//             privateKey: wallet.privateKey,
//             address,
//             provider: wallet.provider,
//             wallet
//         })
//     })
// }))

// GETTERS

// export function getAccounts() {
//     return accounts
// }

// TYPES

export type TestAccount = {
    privateKey: string,
    address: string,
    provider: providers.Provider,
    wallet: Wallet
}
