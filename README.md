## Fey SDK

### Highlights

-   ready-to-use `FeySDK` that wires deployments, vanity salt discovery, and fee-claim flows
-   fully typed ABIs and deployment artifacts for Fey contracts
-   baked-in knowledge of currently supported environments (`base-mainnet`, `eth-sepolia`) with escape hatches for custom deployments
-   simulation support so you can dry-run deployments and claims without broadcasting transactions

### Installation

```bash
npm install @feyprotocol/sdk viem
```

`viem` v2.9+ is a peer dependency; install it in your host project if it is not already present.

### Quick Start

```ts
import {
    createPublicClient,
    createWalletClient,
    http,
    parseAccount,
} from "viem";
import { base } from "viem/chains";
import { FeySDK } from "@feyprotocol/sdk";

const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
});

const walletClient = createWalletClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
    account: parseAccount("0xYourAccount"),
});

const sdk = new FeySDK({
    publicClient,
    walletClient,
    environment: "base-mainnet",
    // Optional overrides (e.g. local dev deployments):
    // addresses: { factory: "0x..." },
    // simulate: true,
});

const { predictedAddress, txHash, waitForTransaction } = await sdk.deployToken(
    {
        token: {
            name: "Example",
            symbol: "EX",
            image: "ipfs://{cid}",
            tokenAdmin: "0xAdmin",
            metadata: { description: "Example token" },
            // Set context with any identifying information that is useful to you
            context: {
                interface: "web",
                platform: "example",
                messageId: "1",
                id: "token-1",
            },
            rewards: {
                recipients: [
                    { recipient: "0xRecipient", bps: 7_000 },
                    { recipient: "0xAdmin", bps: 3_000 },
                ],
            },
            pool: {
                // You must calculate proper pool position ticks for your token to set the starting market cap and liquidity profile.
                // Official tokens target ~27k USD
                positions: [
                    {
                        tickLower: -60200,
                        tickUpper: 50200,
                        positionBps: 10_000,
                    },
                ],
            },
        },
    },
    { confirmations: 3 }
);

console.log("Predicted address:", predictedAddress, "tx:", txHash);
await waitForTransaction();

await sdk.claimFees({ feeOwner: "0xVault" });
```

### `FeySDK` Configuration

-   `publicClient` (required): a Viem public client pointed to the chain you are targeting.
-   `walletClient` (optional but required for live transactions): used when `simulate` is false to sign and broadcast writes.
-   `environment`: `"base-mainnet"` or `"eth-sepolia"`. Determines the default address book and chain id.
-   `addresses`: partial overrides for any known Fey contract (factory, lockers, hooks, etc.). Useful for forks or future deployments.
-   `defaultAccount`: fallbacks when `walletClient.account` is not set.
-   `chainId`, `defaults`, `simulate`: advanced knobs exposed via `FeySdkConfig`.

All config types are exported from `@feyprotocol/sdk` (`FeySdkConfig`, `FeySdkAddresses`, `FeyEnvironment`, …) so you can rely on editor intellisense.

### Deploy Tokens

`sdk.deployToken({ token }, { confirmations })` orchestrates vanity salt generation, deployment config creation, simulation, and final broadcast. Notable behaviors:

-   automatically enforces pool tick spacing, reward BPS totals, and metadata shape
-   optionally adds the dev-buy extension when `token.devBuy.ethAmount` is set
-   returns `{ txHash, predictedAddress, deploymentConfig, waitForTransaction }`
-   respects `simulate` at either the SDK or method level to keep sensitive flows off-chain

When you need granular control (e.g. precompute configs before handing them to an off-chain relayer) you can instantiate `new FeyDeployer(...)` directly and call `buildDeploymentConfig` or `deploy`.

### Claim Locker Fees

Use `sdk.claimFees({ feeOwner, account?, feeLocker?, simulate? })` to invoke the on-chain locker contract. The helper will:

-   default to the environment fee locker & FEY token
-   simulate the transaction first to produce the calldata and gas estimate
-   return `{ hash, waitForReceipt }`

Set `simulate: true` (either on the SDK or the method) to skip broadcasting while still validating the call.

### Environments & Addresses

`FEY_ADDRESSES` and `FEY_CHAIN_IDS` expose the canonical address book:

-   `base-mainnet`: chain id `8453`, factory `0x8EEF0dC80ADf57908bB1be0236c2a72a7e379C2d`, fee locker `0xf739FC4094F3Df0a1Be08E2925b609F3C3Aa13c6`.
-   `eth-sepolia`: chain id `11155111`, factory `0x30304e34F52a233b63BeAb0E0959B255D3cbc739`, fee locker `0xFB7CE8edF568EEF3739cCf5AE11Dda164B35c9a9`.

Import them from `@feyprotocol/sdk` when you need to surface the addresses in your own app (e.g. `import { FEY_ADDRESSES } from "@feyprotocol/sdk";`).

### Standalone Exports

Everything under `src/` is re-exported from the package root:

-   `FeyDeployer`, `claimFees`, and `types` for composing custom flows
-   ABIs under `abis/` and artifacts under `artifacts/` for advanced integrations (e.g. encoding calls yourself)
-   `FEY_ENVIRONMENTS`, `FEY_ADDRESSES`, `FEY_CHAIN_IDS`
