import FeyToken from "./FeyToken.json";

export const FeyTokenArtifact = {
    abi: FeyToken.abi as typeof FeyToken.abi,
    bytecode: FeyToken.bytecode as `0x${string}`,
} as const;

