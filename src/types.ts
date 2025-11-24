import type {
    Account,
    Address,
    Chain,
    Hash,
    Hex,
    PublicClient,
    TransactionReceipt,
    Transport,
    WalletClient,
} from "viem";
import type { FeyEnvironment } from "./environments";

export type AnyPublicClient = PublicClient<Transport, Chain | undefined>;
export type AnyWalletClient = WalletClient<
    Transport,
    Chain | undefined,
    Account
>;

export type RewardRecipient = {
    recipient: Address;
    admin?: Address;
    bps: number;
};

export type PoolPosition =
    | "Standard"
    | Array<{ tickLower: number; tickUpper: number; positionBps: number }>;

export type FeyTokenConfig = {
    name: string;
    symbol: string;
    image: string;
    tokenAdmin: Address;
    metadata: { description: string };
    context: {
        interface: string;
        platform: string;
        messageId: string;
        id: string;
    };
    devBuy?: { ethAmount: number };
    rewards: {
        recipients: Array<RewardRecipient>;
    };
    pool: {
        positions: PoolPosition;
        startingTick?: number;
    };
    fees?: { feyFeeBps?: number; pairedFeeBps?: number };
    vanity?: boolean;
};

export type FeyDeployerAddresses = {
    factory: Address;
    locker: Address;
    devbuy?: Address;
    mevModule: Address;
    feeLocker: Address;
    feeStaticHook: Address;
};

export type FeySdkAddresses = FeyDeployerAddresses & {
    feyToken: Address;
    vault?: Address;
    xFey?: Address;
    weth?: Address;
    hook?: Address;
    buyBackRouter?: Address;
    feeHelper?: Address;
    lpLocker?: Address;
    bootstrap?: Address;
};

export type DeployerDefaults = {
    tickLower?: number;
    tickUpper?: number;
};

export type AutoTickOptions = {
    enabled?: boolean;
    targetMarketCapUsd?: number;
    rangeWidthTicks?: number;
};

export type FeySdkConfig = {
    publicClient: AnyPublicClient;
    walletClient?: AnyWalletClient;
    defaultAccount?: Account;
    environment: FeyEnvironment;
    addresses?: Partial<FeySdkAddresses>;
    chainId?: bigint;
    defaults?: DeployerDefaults;
    autoTicks?: AutoTickOptions;
    simulate?: boolean;
};

export type FeyDeployerConfig = {
    publicClient: AnyPublicClient;
    walletClient?: AnyWalletClient;
    addresses: FeyDeployerAddresses & { feyToken: Address; weth?: Address };
    chainId?: bigint;
    defaults?: DeployerDefaults;
    simulate?: boolean;
};

export type DeploymentConfig = {
    tokenConfig: {
        tokenAdmin: Address;
        name: string;
        symbol: string;
        salt: Hex;
        image: string;
        metadata: string;
        context: string;
        originatingChainId: bigint;
    };
    poolConfig: {
        hook: Address;
        pairedToken: Address;
        tickIfToken0IsFey: number;
        tickSpacing: number;
        poolData: Hex;
    };
    lockerConfig: {
        locker: Address;
        rewardAdmins: Address[];
        rewardRecipients: Address[];
        rewardBps: number[];
        tickLower: number[];
        tickUpper: number[];
        positionBps: number[];
        lockerData: Hex;
    };
    mevModuleConfig: {
        mevModule: Address;
        mevModuleData: Hex;
    };
    extensionConfigs: Array<{
        extension: Address;
        msgValue: bigint;
        extensionBps: number;
        extensionData: Hex;
    }>;
};

export type DeployTokenParams = {
    token: FeyTokenConfig;
    simulate?: boolean;
};

export type DeployTokenResult = {
    txHash: Hash;
    predictedAddress: Address;
    waitForTransaction: (
        confirmations?: number
    ) => Promise<{ address: Address }>;
    deploymentConfig: DeploymentConfig;
};

export type ClaimFeesParams = {
    feeOwner: Address;
    simulate?: boolean;
    feeLocker?: Address;
    account?: Account;
    confirmations?: number;
};

export type TxResult = {
    hash: Hash;
    waitForReceipt: (
        confirmations?: number
    ) => Promise<TransactionReceipt | undefined>;
};
