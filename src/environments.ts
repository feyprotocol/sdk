import type { Address } from "viem";

export const FEY_ENVIRONMENTS = ["eth-sepolia", "base-mainnet"] as const;
export type FeyEnvironment = (typeof FEY_ENVIRONMENTS)[number];

export type FeyEnvironmentAddresses = {
    factory: Address;
    locker: Address;
    hook?: Address;
    feeStaticHook: Address;
    mevModule: Address;
    devbuy?: Address;
    feeLocker: Address;
    feyToken: Address;
    vault?: Address;
    xFey?: Address;
    buyBackRouter?: Address;
    feeHelper?: Address;
    lpLocker?: Address;
    bootstrap?: Address;
    weth?: Address;
};

export const FEY_ADDRESSES: Record<FeyEnvironment, FeyEnvironmentAddresses> = {
    "eth-sepolia": {
        factory: "0x30304e34F52a233b63BeAb0E0959B255D3cbc739" as Address,
        locker: "0x37E00F6Dd89EE447297Eb48cB868b791171A7BCB" as Address,
        hook: "0x932D55D7B86d27eedd0934503e49F5F362FAa8cc" as Address,
        feeStaticHook: "0x932D55D7B86d27eedd0934503e49F5F362FAa8cc" as Address,
        mevModule: "0x4f22145a5E4bba42092B29FC12b3bC346d42De71" as Address,
        devbuy: "0xD9f8bF18259160Ae26fE926E5C958320d5E900A0" as Address,
        feeLocker: "0xFB7CE8edF568EEF3739cCf5AE11Dda164B35c9a9" as Address,
        feyToken: "0xa76533E77228E76C1d65c7BD3834228730f77Ffd" as Address,
        vault: "0x188A2E743fA6b798a09dFAcd3Cd39C827D7daa68" as Address,
        xFey: "0x188A2E743fA6b798a09dFAcd3Cd39C827D7daa68" as Address,
        buyBackRouter: "0x2c3948170691660CB974b5B8885A2818C4C179d0" as Address,
        lpLocker: "0x37E00F6Dd89EE447297Eb48cB868b791171A7BCB" as Address,
    },
    "base-mainnet": {
        factory: "0x8EEF0dC80ADf57908bB1be0236c2a72a7e379C2d" as Address,
        locker: "0x282B4e72a79ebe79c1bd295c5ebd72940e50e836" as Address,
        hook: "0x5B409184204b86f708d3aeBb3cad3F02835f68cC" as Address,
        feeStaticHook: "0x5B409184204b86f708d3aeBb3cad3F02835f68cC" as Address,
        mevModule: "0x2ebc0fA629b268dFA3d455b67027d507a562EAC0" as Address,
        devbuy: "0x173077c319c38bb08D4C4968014357fd518446b4" as Address,
        feeLocker: "0xf739FC4094F3Df0a1Be08E2925b609F3C3Aa13c6" as Address,
        feyToken: "0xD09cf0982A32DD6856e12d6BF2F08A822eA5D91D" as Address,
        vault: "0x72f5565Ab147105614ca4Eb83ecF15f751Fd8C50" as Address,
        xFey: "0x72f5565Ab147105614ca4Eb83ecF15f751Fd8C50" as Address,
        buyBackRouter: "0x97828Af05d581368d8Ee3Da14c06d9B168D0A1F5" as Address,
        lpLocker: "0x282B4e72a79ebe79c1bd295c5ebd72940e50e836" as Address,
    },
};

export const FEY_CHAIN_IDS: Record<FeyEnvironment, bigint> = {
    "eth-sepolia": 11155111n,
    "base-mainnet": 8453n,
};
