import {
    DEFAULT_TICK_SPACING,
    FEY_TOKEN_SUPPLY,
    UNISWAP_V4_MAX_TICK,
    UNISWAP_V4_MIN_TICK,
} from "../constants";

const DEFAULT_TARGET_MARKET_CAP_USD = 27_000;
const DEFAULT_RANGE_WIDTH_TICKS = 110_400;
const LOG_BASE = Math.log(1.0001);

export type TickDerivationParams = {
    feyPriceUsd: number;
    targetMarketCapUsd?: number;
    tickSpacing?: number;
    rangeWidthTicks?: number;
};

export type TickDerivationResult = {
    tickLower: number;
    tickUpper: number;
};

function clampTick(value: number) {
    return Math.max(UNISWAP_V4_MIN_TICK, Math.min(UNISWAP_V4_MAX_TICK, value));
}

function roundToSpacing(tick: number, spacing: number) {
    // Mirrors tools/token_launch_ticks.py: round(tick / spacing) * spacing
    return Math.round(tick / spacing) * spacing;
}

export function deriveTicksFromFeyUsdPrice(
    params: TickDerivationParams
): TickDerivationResult {
    if (!Number.isFinite(params.feyPriceUsd) || params.feyPriceUsd <= 0) {
        throw new Error("Invalid FEY price passed to tick derivation");
    }
    const tickSpacing = params.tickSpacing ?? DEFAULT_TICK_SPACING;
    const targetMarketCapUsd =
        params.targetMarketCapUsd ?? DEFAULT_TARGET_MARKET_CAP_USD;
    const requestedRange = params.rangeWidthTicks ?? DEFAULT_RANGE_WIDTH_TICKS;

    if (tickSpacing <= 0) {
        throw new Error("tickSpacing must be positive");
    }
    if (requestedRange <= 0) {
        throw new Error("rangeWidthTicks must be positive");
    }

    const rangeWidthTicks =
        Math.floor(requestedRange / tickSpacing) * tickSpacing || tickSpacing;

    const tokenPriceUsd = targetMarketCapUsd / FEY_TOKEN_SUPPLY;
    const tokenPriceInFey = tokenPriceUsd / params.feyPriceUsd;

    if (!Number.isFinite(tokenPriceInFey) || tokenPriceInFey <= 0) {
        throw new Error(
            "Could not convert token USD price into FEY terms for ticks"
        );
    }

    const rawTick = Math.log(tokenPriceInFey) / LOG_BASE;
    const alignedLower = roundToSpacing(rawTick, tickSpacing);

    const clampedLower = clampTick(alignedLower);
    const maxLower = UNISWAP_V4_MAX_TICK - rangeWidthTicks;
    const safeLower = clampTick(Math.min(clampedLower, maxLower));
    const tickUpper = clampTick(safeLower + rangeWidthTicks);

    return {
        tickLower: safeLower,
        tickUpper,
    };
}
