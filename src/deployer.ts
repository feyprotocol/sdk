import {
    encodeAbiParameters,
    parseAbiParameters,
    encodeDeployData,
    keccak256,
    decodeEventLog,
    stringify,
    padHex,
    parseEther,
    type Address,
    type Account,
    type Hash,
    type Hex,
} from "viem";

import { feyAbi } from "./abis/fey";
import { FeyTokenArtifact } from "./artifacts/feyToken";
import type {
    DeploymentConfig,
    FeyDeployerAddresses,
    FeyDeployerConfig,
    FeyTokenConfig,
    PoolPosition,
    RewardRecipient,
} from "./types";

const MAX_SUPPLY = BigInt(100_000_000_000) * 10n ** 18n;
const DYNAMIC_FEE_FLAG = 0x800000;
const DEFAULT_CHAIN_ID = 8453n;
const DEFAULT_TICK_SPACING = 200;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

type SaltResult = {
    salt: Hex;
    predictedAddress?: Address;
};

function getCreationBytecode(): Hex {
    const bytecode = (FeyTokenArtifact as any)?.bytecode;
    if (
        !bytecode ||
        typeof bytecode !== "string" ||
        !bytecode.startsWith("0x")
    ) {
        throw new Error("FeyToken artifact is missing creation bytecode");
    }
    return bytecode as Hex;
}

function assertTickMultipleOfSpacing(tick: number, spacing: number) {
    if (tick % spacing !== 0) {
        throw new Error(`Tick ${tick} is not a multiple of spacing ${spacing}`);
    }
}

function assertBpsSumTo10000(values: number[], label: string) {
    const total = values.reduce((acc, value) => acc + value, 0);
    if (total !== 10_000) {
        throw new Error(`${label} must sum to 10_000, got ${total}`);
    }
}

function encodeStaticFeePoolData(params: {
    feyFeeBps: number;
    pairedFeeBps: number;
}): Hex {
    const feyFeePpm = params.feyFeeBps * 100;
    const pairedFeePpm = params.pairedFeeBps * 100;

    const feeData = encodeAbiParameters(
        [
            { name: "feyFee", type: "uint24" },
            { name: "pairedFee", type: "uint24" },
        ],
        [feyFeePpm, pairedFeePpm]
    ) as Hex;

    return encodeAbiParameters(
        [
            { name: "extension", type: "address" },
            { name: "extensionData", type: "bytes" },
            { name: "feeData", type: "bytes" },
        ],
        ["0x0000000000000000000000000000000000000000", "0x", feeData]
    ) as Hex;
}

async function findAddressBelowTarget({
    constructorArgs,
    admin,
    deployer,
    target,
    maxAttempts = 500_000,
}: {
    constructorArgs: any[];
    admin: Address;
    deployer: Address;
    target: Address;
    maxAttempts?: number;
}): Promise<{ salt: Hex; token: Address }> {
    const data: Hex = encodeDeployData({
        abi: FeyTokenArtifact.abi as any,
        bytecode: getCreationBytecode(),
        args: constructorArgs,
    });
    const initCodeHash: Hex = keccak256(data);

    const targetBig = BigInt(target);
    const deployerNo0x = deployer.slice(2);
    const saltParams = parseAbiParameters("address admin, bytes32 innerSalt");

    let attempts = 0;
    let salt = 0n;

    while (attempts < maxAttempts) {
        const innerSalt = padHex(`0x${salt.toString(16)}`, {
            size: 32,
        }) as Hex;

        const enc = encodeAbiParameters(saltParams, [admin, innerSalt]);
        const factorySalt = keccak256(enc);

        const preimage = `0xff${deployerNo0x}${factorySalt.slice(
            2
        )}${initCodeHash.slice(2)}` as Hex;
        const h = keccak256(preimage);
        const addr = `0x${h.slice(-40)}` as Address;

        if (BigInt(addr) < targetBig) {
            return { token: addr, salt: innerSalt };
        }

        salt++;
        attempts++;
    }

    throw new Error(`No vanity hit < ${target} within ${maxAttempts} salts`);
}

export class FeyDeployer {
    readonly walletClient?: FeyDeployerConfig["walletClient"];
    readonly publicClient: FeyDeployerConfig["publicClient"];
    readonly addresses: FeyDeployerAddresses;
    readonly feyToken: Address;
    readonly simulate: boolean;
    readonly chainId: bigint;
    private readonly defaults: {
        tickLower?: number;
        tickUpper?: number;
    };
    private readonly weth?: Address;

    constructor(config: FeyDeployerConfig) {
        this.walletClient = config.walletClient;
        this.publicClient = config.publicClient;

        this.addresses = {
            factory: config.addresses.factory,
            locker: config.addresses.locker,
            devbuy: config.addresses.devbuy,
            mevModule: config.addresses.mevModule,
            feeLocker: config.addresses.feeLocker,
            feeStaticHook: config.addresses.feeStaticHook,
        };

        this.feyToken = config.addresses.feyToken;
        this.weth = config.addresses.weth;
        this.simulate = Boolean(config.simulate);
        this.chainId = config.chainId ?? DEFAULT_CHAIN_ID;

        this.defaults = {
            tickLower: config.defaults?.tickLower,
            tickUpper: config.defaults?.tickUpper,
        };

        if (!this.addresses.factory || !this.feyToken) {
            throw new Error("Fey factory and FEY token addresses are required");
        }
    }

    private get tickSpacing(): number {
        return DEFAULT_TICK_SPACING;
    }

    private getStandardPositions() {
        const tickLower = this.defaults.tickLower;
        const tickUpper = this.defaults.tickUpper;
        if (typeof tickLower !== "number" || typeof tickUpper !== "number") {
            throw new Error(
                "tickLower and tickUpper must be provided when using Standard pool positions"
            );
        }
        return [{ tickLower, tickUpper, positionBps: 10_000 }];
    }

    private getPositions(
        kind: PoolPosition
    ): Array<{ tickLower: number; tickUpper: number; positionBps: number }> {
        if (Array.isArray(kind)) return kind;
        return this.getStandardPositions();
    }

    private validatePositions(
        positions: Array<{ tickLower: number; tickUpper: number }>
    ) {
        positions.forEach(({ tickLower, tickUpper }) => {
            assertTickMultipleOfSpacing(tickLower, this.tickSpacing);
            assertTickMultipleOfSpacing(tickUpper, this.tickSpacing);
        });
    }

    private validateRecipients(recipients: RewardRecipient[]) {
        assertBpsSumTo10000(
            recipients.map((recipient) => recipient.bps),
            "Reward BPS"
        );
    }

    private encodeLockerData(recipients: RewardRecipient[]): Hex {
        return encodeAbiParameters(
            [
                {
                    type: "tuple",
                    components: [{ name: "feePreference", type: "uint8[]" }],
                },
            ],
            [
                {
                    feePreference: recipients.map(() => 1),
                },
            ]
        ) as Hex;
    }

    private async vanitySearch(
        token: FeyTokenConfig,
        constructorArgs: any[]
    ): Promise<SaltResult> {
        const { salt, token: predictedAddress } = await findAddressBelowTarget({
            constructorArgs,
            admin: token.tokenAdmin,
            deployer: this.addresses.factory,
            target: this.feyToken,
        });

        return { salt, predictedAddress };
    }

    async generateSalt(token: FeyTokenConfig): Promise<SaltResult> {
        const constructorArgs = [
            token.name,
            token.symbol,
            MAX_SUPPLY,
            token.tokenAdmin,
            token.image ?? "",
            stringify(token.metadata) || "",
            stringify(token.context) || "",
            this.chainId,
        ];

        return this.vanitySearch(token, constructorArgs);
    }

    predictTokenAddressFromSalt(salt: Hex, token: FeyTokenConfig): Address {
        const args = [
            token.name,
            token.symbol,
            MAX_SUPPLY,
            token.tokenAdmin,
            token.image ?? "",
            stringify(token.metadata) || "",
            stringify(token.context) || "",
            this.chainId,
        ];

        const data = encodeDeployData({
            abi: FeyTokenArtifact.abi as any,
            bytecode: getCreationBytecode(),
            args,
        });
        const initCodeHash = keccak256(data);

        const abiEncoded = encodeAbiParameters(
            parseAbiParameters("address admin, bytes32 innerSalt"),
            [token.tokenAdmin, padHex(salt, { size: 32 }) as Hex]
        );
        const factorySalt = keccak256(abiEncoded);
        const h = keccak256(
            `0xff${this.addresses.factory.slice(2)}${factorySalt.slice(
                2
            )}${initCodeHash.slice(2)}`
        );

        return `0x${h.slice(-40)}` as Address;
    }

    private predictFromDeploymentConfigSalt(
        innerSalt: Hex,
        tokenArgs: [
            string,
            string,
            bigint,
            Address,
            string,
            string,
            string,
            bigint
        ]
    ): Address {
        const initCode = encodeDeployData({
            abi: FeyTokenArtifact.abi as any,
            bytecode: getCreationBytecode(),
            args: tokenArgs,
        });
        const initCodeHash = keccak256(initCode);

        const enc = encodeAbiParameters(
            parseAbiParameters("address admin, bytes32 innerSalt"),
            [tokenArgs[3], padHex(innerSalt, { size: 32 }) as Hex]
        );
        const factorySalt = keccak256(enc);
        const preimage = `0xff${this.addresses.factory.slice(
            2
        )}${factorySalt.slice(2)}${initCodeHash.slice(2)}` as Hex;
        const h = keccak256(preimage);
        return `0x${h.slice(-40)}` as Address;
    }

    async predictTokenAddress(token: FeyTokenConfig): Promise<Address> {
        const { salt, predictedAddress } = await this.generateSalt(token);
        if (predictedAddress) return predictedAddress;
        return this.predictTokenAddressFromSalt(salt, token);
    }

    async buildDeploymentConfig(
        token: FeyTokenConfig
    ): Promise<{ config: DeploymentConfig; predictedTokenAddress: Address }> {
        const { salt, predictedAddress } = await this.generateSalt(token);

        const predictedTokenAddress =
            predictedAddress ?? this.predictTokenAddressFromSalt(salt, token);

        const feyIsToken0 =
            this.feyToken.toLowerCase() < predictedTokenAddress.toLowerCase();

        if (feyIsToken0) {
            throw new Error(
                "Could not generate a vanity address with FEY as token1. Please try deploying again."
            );
        }

        const positions = this.getPositions(token.pool.positions);
        const firstPosition = positions[0];
        if (!firstPosition) {
            throw new Error("At least one pool position is required");
        }

        const tickLower = firstPosition.tickLower;
        if (typeof tickLower !== "number") {
            throw new Error("pool positions must include a numeric tickLower");
        }

        if (
            typeof token.pool.startingTick === "number" &&
            token.pool.startingTick !== tickLower
        ) {
            throw new Error(
                "pool.startingTick must equal the first position tickLower"
            );
        }

        this.validatePositions(positions);
        this.validateRecipients(token.rewards.recipients);

        const staticFees = {
            feyFeeBps: token.fees?.feyFeeBps ?? 100,
            pairedFeeBps: token.fees?.pairedFeeBps ?? 100,
        };

        const deploymentConfig: DeploymentConfig = {
            tokenConfig: {
                tokenAdmin: token.tokenAdmin,
                name: token.name,
                symbol: token.symbol,
                salt,
                image: token.image,
                metadata: stringify(token.metadata),
                context: stringify(token.context),
                originatingChainId: this.chainId,
            },
            poolConfig: {
                hook: this.addresses.feeStaticHook,
                pairedToken: this.feyToken,
                tickIfToken0IsFey: tickLower,
                tickSpacing: this.tickSpacing,
                poolData: encodeStaticFeePoolData(staticFees),
            },
            lockerConfig: {
                locker: this.addresses.locker,
                rewardAdmins: token.rewards.recipients.map(
                    (recipient: RewardRecipient) =>
                        recipient.admin ?? recipient.recipient
                ),
                rewardRecipients: token.rewards.recipients.map(
                    (recipient: RewardRecipient) => recipient.recipient
                ),
                rewardBps: token.rewards.recipients.map(
                    (recipient: RewardRecipient) => recipient.bps
                ),
                tickLower: positions.map((p) => p.tickLower),
                tickUpper: positions.map((p) => p.tickUpper),
                positionBps: positions.map((p) => p.positionBps),
                lockerData: this.encodeLockerData(token.rewards.recipients),
            },
            mevModuleConfig: {
                mevModule: this.addresses.mevModule,
                mevModuleData: "0x",
            },
            extensionConfigs: [],
        };

        if (token.devBuy && token.devBuy.ethAmount > 0) {
            if (!this.addresses.devbuy) {
                throw new Error("Dev buy extension address is required");
            }

            const weth = (this.weth ?? (ZERO_ADDRESS as Address)) as Address;
            const hook = this.addresses.feeStaticHook;
            const fey = this.feyToken;

            const currency0 =
                fey.toLowerCase() < weth.toLowerCase() ? fey : weth;
            const currency1 = currency0 === fey ? weth : fey;

            const pairedTokenPoolKey = {
                currency0,
                currency1,
                fee: DYNAMIC_FEE_FLAG,
                tickSpacing: this.tickSpacing,
                hooks: hook,
            } as const;

            const devBuyExtensionData = encodeAbiParameters(
                [
                    {
                        type: "tuple",
                        components: [
                            { name: "currency0", type: "address" },
                            { name: "currency1", type: "address" },
                            { name: "fee", type: "uint24" },
                            { name: "tickSpacing", type: "int24" },
                            { name: "hooks", type: "address" },
                        ],
                    },
                    { name: "pairedTokenAmountOutMinimum", type: "uint128" },
                    { name: "recipient", type: "address" },
                ],
                [pairedTokenPoolKey, 0n, token.tokenAdmin]
            ) as Hex;

            const msgValue = parseEther(String(token.devBuy.ethAmount));

            deploymentConfig.extensionConfigs.push({
                extension: this.addresses.devbuy,
                msgValue,
                extensionBps: 0,
                extensionData: devBuyExtensionData,
            });
        }

        return { config: deploymentConfig, predictedTokenAddress };
    }

    async deploy(
        token: FeyTokenConfig,
        options?: {
            account?: Account;
            simulate?: boolean;
            confirmations?: number;
        }
    ) {
        if (!this.publicClient) {
            throw new Error("Public client is required");
        }

        const simulateOnly = options?.simulate ?? this.simulate;

        if (!simulateOnly && (!this.walletClient || !this.publicClient)) {
            throw new Error("Wallet client required for deployment");
        }

        if (!token.name || !token.symbol || !token.image) {
            throw new Error("Token name, symbol, and image are required");
        }
        if (!token.tokenAdmin || !token.tokenAdmin.startsWith("0x")) {
            throw new Error("Valid token admin address is required");
        }

        const { config: deploymentConfig, predictedTokenAddress } =
            await this.buildDeploymentConfig(token);

        const args: [
            string,
            string,
            bigint,
            Address,
            string,
            string,
            string,
            bigint
        ] = [
            deploymentConfig.tokenConfig.name,
            deploymentConfig.tokenConfig.symbol,
            MAX_SUPPLY,
            deploymentConfig.tokenConfig.tokenAdmin,
            deploymentConfig.tokenConfig.image,
            deploymentConfig.tokenConfig.metadata,
            deploymentConfig.tokenConfig.context,
            deploymentConfig.tokenConfig.originatingChainId,
        ];

        const account =
            options?.account ?? this.walletClient?.account ?? undefined;

        if (!simulateOnly && !account) {
            throw new Error("Account is required to send transactions");
        }

        const preflightAddr = this.predictFromDeploymentConfigSalt(
            deploymentConfig.tokenConfig.salt,
            args
        );

        const totalMsgValue = deploymentConfig.extensionConfigs.reduce(
            (acc: bigint, ext: DeploymentConfig["extensionConfigs"][number]) =>
                acc + BigInt(ext.msgValue || 0n),
            0n
        );

        if (simulateOnly) {
            const fakeHash = ("0x" + "ab".repeat(32)) as Hash;
            return {
                txHash: fakeHash,
                predictedAddress: predictedTokenAddress,
                deploymentConfig,
                waitForTransaction: async () => ({
                    address: preflightAddr,
                }),
            };
        }

        const { request } = await this.publicClient.simulateContract({
            address: this.addresses.factory,
            abi: feyAbi,
            functionName: "deployToken",
            args: [deploymentConfig],
            account,
            value: totalMsgValue,
        });

        const hash = (await this.walletClient!.writeContract(request)) as Hash;

        return {
            txHash: hash,
            predictedAddress: predictedTokenAddress,
            deploymentConfig,
            waitForTransaction: async (
                confirmations = options?.confirmations ?? 1
            ) => {
                const receipt =
                    await this.publicClient.waitForTransactionReceipt({
                        hash,
                        confirmations,
                        timeout: 120_000, // 2 minute timeout for waiting for confirmations
                    });
                if (receipt.status === "reverted") {
                    throw new Error(
                        `Transaction reverted. Check explorer for tx ${hash}`
                    );
                }

                for (const log of receipt.logs) {
                    if (
                        log.address.toLowerCase() !==
                        this.addresses.factory.toLowerCase()
                    ) {
                        continue;
                    }
                    try {
                        const decoded = decodeEventLog({
                            abi: feyAbi,
                            data: log.data,
                            topics: log.topics,
                        });
                        if (decoded.eventName === "TokenCreated") {
                            const tokenAddress = decoded.args[
                                "tokenAddress"
                            ] as Address;
                            if (
                                !tokenAddress ||
                                tokenAddress ===
                                    "0x0000000000000000000000000000000000000000"
                            ) {
                                throw new Error(
                                    "Invalid token address emitted"
                                );
                            }

                            return { address: tokenAddress };
                        }
                    } catch {
                        // Ignore decode errors
                    }
                }
                throw new Error(
                    `TokenCreated event not found. Check explorer for tx ${hash}`
                );
            },
        };
    }
}
