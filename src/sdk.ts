import type { Account } from "viem";

import { FeyDeployer } from "./deployer";
import { claimFees as claimLockerFees } from "./fees";
import { FEY_ADDRESSES, FEY_CHAIN_IDS } from "./environments";
import type {
    ClaimFeesParams,
    DeployTokenParams,
    DeployTokenResult,
    FeySdkConfig,
    FeySdkAddresses,
    TxResult,
} from "./types";

export class FeySDK {
    readonly publicClient: FeySdkConfig["publicClient"];
    readonly walletClient?: FeySdkConfig["walletClient"];
    readonly environment: FeySdkConfig["environment"];
    readonly addresses: FeySdkAddresses;
    readonly simulate: boolean;
    private readonly defaultAccount?: Account;
    private readonly deployer: FeyDeployer;

    constructor(config: FeySdkConfig) {
        this.publicClient = config.publicClient;
        this.walletClient = config.walletClient;
        this.environment = config.environment;
        const baseAddresses = FEY_ADDRESSES[this.environment];
        const merged = {
            ...baseAddresses,
            ...(config.addresses ?? {}),
        } as FeySdkAddresses;

        const requiredKeys: Array<keyof FeySdkAddresses> = [
            "factory",
            "locker",
            "mevModule",
            "feeLocker",
            "feeStaticHook",
            "feyToken",
        ];
        for (const key of requiredKeys) {
            if (!merged[key]) {
                throw new Error(
                    `Missing required Fey address '${key}' for environment ${this.environment}`
                );
            }
        }

        this.addresses = merged;
        this.simulate = Boolean(config.simulate);
        this.defaultAccount =
            config.defaultAccount ?? config.walletClient?.account ?? undefined;

        this.deployer = new FeyDeployer({
            publicClient: config.publicClient,
            walletClient: config.walletClient,
            addresses: {
                factory: this.addresses.factory,
                locker: this.addresses.locker,
                devbuy: this.addresses.devbuy,
                mevModule: this.addresses.mevModule,
                feeLocker: this.addresses.feeLocker,
                feeStaticHook: this.addresses.feeStaticHook,
                feyToken: this.addresses.feyToken,
                weth: this.addresses.weth,
            },
            chainId: config.chainId ?? FEY_CHAIN_IDS[this.environment],
            defaults: config.defaults,
            simulate: config.simulate,
        });
    }

    private resolveAccount(explicit?: Account) {
        return explicit ?? this.defaultAccount ?? this.walletClient?.account;
    }

    async deployToken(
        params: DeployTokenParams,
        options?: { account?: Account; confirmations?: number }
    ): Promise<DeployTokenResult> {
        const account = this.resolveAccount(options?.account);
        return this.deployer.deploy(params.token, {
            simulate: params.simulate ?? this.simulate,
            account,
            confirmations: options?.confirmations,
        });
    }

    async claimFees(params: ClaimFeesParams): Promise<TxResult> {
        return claimLockerFees(
            {
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                defaultAccount: this.resolveAccount(params.account),
                feeLocker: params.feeLocker ?? this.addresses.feeLocker,
                feyToken: this.addresses.feyToken,
                simulate: params.simulate ?? this.simulate,
            },
            params
        );
    }

    getDeployer() {
        return this.deployer;
    }
}
