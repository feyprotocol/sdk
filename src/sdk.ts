import type { Account } from "viem";

import { DexScreenerClient } from "./clients/dexscreener";
import { FeyDeployer } from "./deployer";
import { claimFees as claimLockerFees } from "./fees";
import { FEY_ADDRESSES, FEY_CHAIN_IDS } from "./environments";
import { deriveTicksFromFeyUsdPrice } from "./pricing/ticks";
import type {
    ClaimFeesParams,
    DeployTokenParams,
    DeployTokenResult,
    FeySdkConfig,
    FeySdkAddresses,
    TxResult,
} from "./types";

type ResolvedAutoTickOptions = {
    enabled: boolean;
    targetMarketCapUsd: number;
    rangeWidthTicks: number;
};

const DEFAULT_AUTO_TICK_OPTIONS: ResolvedAutoTickOptions = {
    enabled: true,
    targetMarketCapUsd: 27_000,
    rangeWidthTicks: 110_400,
};

export class FeySDK {
    readonly publicClient: FeySdkConfig["publicClient"];
    readonly walletClient?: FeySdkConfig["walletClient"];
    readonly environment: FeySdkConfig["environment"];
    readonly addresses: FeySdkAddresses;
    readonly simulate: boolean;
    private readonly defaultAccount?: Account;
    private readonly deployer: FeyDeployer;
    private readonly autoTickOptions: ResolvedAutoTickOptions;
    private readonly dexScreenerClient: DexScreenerClient;

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

        const shouldEnableAutoTicks =
            config.autoTicks?.enabled ??
            (this.environment === "base-mainnet" && !config.defaults);

        this.autoTickOptions = {
            enabled: shouldEnableAutoTicks,
            targetMarketCapUsd:
                config.autoTicks?.targetMarketCapUsd ??
                DEFAULT_AUTO_TICK_OPTIONS.targetMarketCapUsd,
            rangeWidthTicks:
                config.autoTicks?.rangeWidthTicks ??
                DEFAULT_AUTO_TICK_OPTIONS.rangeWidthTicks,
        };

        this.dexScreenerClient = new DexScreenerClient();

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
        const tokenWithTicks = await this.resolveAutoTicks(params.token);
        return this.deployer.deploy(tokenWithTicks, {
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

    private async resolveAutoTicks(token: DeployTokenParams["token"]) {
        if (
            !this.autoTickOptions.enabled ||
            Array.isArray(token.pool.positions)
        ) {
            return token;
        }

        try {
            const quote = await this.dexScreenerClient.getFeyPriceQuote();
            const ticks = deriveTicksFromFeyUsdPrice({
                feyPriceUsd: quote.usedPriceUsd,
                targetMarketCapUsd: this.autoTickOptions.targetMarketCapUsd,
                rangeWidthTicks: this.autoTickOptions.rangeWidthTicks,
            });

            return {
                ...token,
                pool: {
                    ...token.pool,
                    positions: [
                        {
                            tickLower: ticks.tickLower,
                            tickUpper: ticks.tickUpper,
                            positionBps: 10_000,
                        },
                    ],
                    startingTick: token.pool.startingTick ?? ticks.tickLower,
                },
            };
        } catch (error) {
            throw new Error(
                `Failed to derive automatic ticks: ${(error as Error).message}`
            );
        }
    }
}
