import type { Account, Address, Hash } from "viem";

import { feeLockerAbi } from "./abis/feeLocker";
import type {
    AnyPublicClient,
    AnyWalletClient,
    ClaimFeesParams,
    TxResult,
} from "./types";

type ClaimFeesContext = {
    publicClient: AnyPublicClient;
    walletClient?: AnyWalletClient;
    defaultAccount?: Account;
    feeLocker?: Address;
    feyToken: Address;
    simulate?: boolean;
};

export async function claimFees(
    ctx: ClaimFeesContext,
    params: ClaimFeesParams
): Promise<TxResult> {
    const feeLocker = params.feeLocker ?? ctx.feeLocker;
    const token = ctx.feyToken;

    if (!feeLocker) {
        throw new Error("Fee locker address is required to claim fees");
    }

    const simulateOnly = params.simulate ?? ctx.simulate ?? false;

    const account =
        params.account ??
        ctx.defaultAccount ??
        ctx.walletClient?.account ??
        undefined;

    if (!simulateOnly && !ctx.walletClient) {
        throw new Error("Wallet client required to claim fees");
    }

    if (!account) {
        throw new Error("Account is required to claim fees");
    }

    const simulation = await ctx.publicClient.simulateContract({
        address: feeLocker,
        abi: feeLockerAbi,
        functionName: "claim",
        args: [params.feeOwner, token],
        account,
    });

    if (simulateOnly) {
        const fakeHash = ("0x" + "cd".repeat(32)) as Hash;
        return {
            hash: fakeHash,
            waitForReceipt: async () => undefined,
        };
    }

    const hash = (await ctx.walletClient!.writeContract(
        simulation.request
    )) as Hash;

    return {
        hash,
        waitForReceipt: async (
            confirmations = params.confirmations ?? 1
        ) => ctx.publicClient.waitForTransactionReceipt({ hash, confirmations }),
    };
}

