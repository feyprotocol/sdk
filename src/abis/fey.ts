export const feyAbi = [
    {
        type: "function",
        name: "deployToken",
        inputs: [
            {
                name: "deploymentConfig",
                type: "tuple",
                internalType: "struct IFey.DeploymentConfig",
                components: [
                    {
                        name: "tokenConfig",
                        type: "tuple",
                        internalType: "struct IFey.TokenConfig",
                        components: [
                            {
                                name: "tokenAdmin",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "name",
                                type: "string",
                                internalType: "string",
                            },
                            {
                                name: "symbol",
                                type: "string",
                                internalType: "string",
                            },
                            {
                                name: "salt",
                                type: "bytes32",
                                internalType: "bytes32",
                            },
                            {
                                name: "image",
                                type: "string",
                                internalType: "string",
                            },
                            {
                                name: "metadata",
                                type: "string",
                                internalType: "string",
                            },
                            {
                                name: "context",
                                type: "string",
                                internalType: "string",
                            },
                            {
                                name: "originatingChainId",
                                type: "uint256",
                                internalType: "uint256",
                            },
                        ],
                    },
                    {
                        name: "poolConfig",
                        type: "tuple",
                        internalType: "struct IFey.PoolConfig",
                        components: [
                            {
                                name: "hook",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "pairedToken",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "tickIfToken0IsFey",
                                type: "int24",
                                internalType: "int24",
                            },
                            {
                                name: "tickSpacing",
                                type: "int24",
                                internalType: "int24",
                            },
                            {
                                name: "poolData",
                                type: "bytes",
                                internalType: "bytes",
                            },
                        ],
                    },
                    {
                        name: "lockerConfig",
                        type: "tuple",
                        internalType: "struct IFey.LockerConfig",
                        components: [
                            {
                                name: "locker",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "rewardAdmins",
                                type: "address[]",
                                internalType: "address[]",
                            },
                            {
                                name: "rewardRecipients",
                                type: "address[]",
                                internalType: "address[]",
                            },
                            {
                                name: "rewardBps",
                                type: "uint16[]",
                                internalType: "uint16[]",
                            },
                            {
                                name: "tickLower",
                                type: "int24[]",
                                internalType: "int24[]",
                            },
                            {
                                name: "tickUpper",
                                type: "int24[]",
                                internalType: "int24[]",
                            },
                            {
                                name: "positionBps",
                                type: "uint16[]",
                                internalType: "uint16[]",
                            },
                            {
                                name: "lockerData",
                                type: "bytes",
                                internalType: "bytes",
                            },
                        ],
                    },
                    {
                        name: "mevModuleConfig",
                        type: "tuple",
                        internalType: "struct IFey.MevModuleConfig",
                        components: [
                            {
                                name: "mevModule",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "mevModuleData",
                                type: "bytes",
                                internalType: "bytes",
                            },
                        ],
                    },
                    {
                        name: "extensionConfigs",
                        type: "tuple[]",
                        internalType: "struct IFey.ExtensionConfig[]",
                        components: [
                            {
                                name: "extension",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "msgValue",
                                type: "uint256",
                                internalType: "uint256",
                            },
                            {
                                name: "extensionBps",
                                type: "uint16",
                                internalType: "uint16",
                            },
                            {
                                name: "extensionData",
                                type: "bytes",
                                internalType: "bytes",
                            },
                        ],
                    },
                ],
            },
        ],
        outputs: [
            {
                name: "tokenAddress",
                type: "address",
                internalType: "address",
            },
        ],
        stateMutability: "payable",
    },
    {
        type: "event",
        name: "TokenCreated",
        inputs: [
            {
                name: "msgSender",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "tokenAddress",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "tokenAdmin",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "tokenImage",
                type: "string",
                indexed: false,
                internalType: "string",
            },
            {
                name: "tokenName",
                type: "string",
                indexed: false,
                internalType: "string",
            },
            {
                name: "tokenSymbol",
                type: "string",
                indexed: false,
                internalType: "string",
            },
            {
                name: "tokenMetadata",
                type: "string",
                indexed: false,
                internalType: "string",
            },
            {
                name: "tokenContext",
                type: "string",
                indexed: false,
                internalType: "string",
            },
            {
                name: "startingTick",
                type: "int24",
                indexed: false,
                internalType: "int24",
            },
            {
                name: "poolHook",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "poolId",
                type: "bytes32",
                indexed: false,
                internalType: "PoolId",
            },
            {
                name: "pairedToken",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "locker",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "mevModule",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "extensionsSupply",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "extensions",
                type: "address[]",
                indexed: false,
                internalType: "address[]",
            },
        ],
        anonymous: false,
    },
] as const;

