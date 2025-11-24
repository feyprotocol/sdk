import assert from "node:assert/strict";
import test from "node:test";

import { DexScreenerClient } from "../clients/dexscreener.js";
import { deriveTicksFromFeyUsdPrice } from "../pricing/ticks.js";

const SAMPLE_PRICE_USD = 0.00002852;
const SAMPLE_PRICE_CHANGE_H6 = 1.11;
const SAMPLE_PRICE_CHANGE_H1 = 1.5;

function approxEqual(actual: number, expected: number, tolerance = 1e-12) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

test("DexScreenerClient derives TWAP price and auto ticks", async () => {
    let fetchCount = 0;

    const mockFetch = async () => {
        fetchCount++;
        return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                pair: {
                    priceUsd: SAMPLE_PRICE_USD.toString(),
                    priceChange: {
                        h6: SAMPLE_PRICE_CHANGE_H6,
                        h1: SAMPLE_PRICE_CHANGE_H1,
                    },
                },
            }),
        } as Response;
    };

    const client = new DexScreenerClient({
        fetchFn: mockFetch,
        cacheTtlMs: 60_000,
        volatilityGuard: {
            maxHourlyChangePct: 60,
            maxSpotDeviationRatio: 0.5,
        },
    });

    const quote = await client.getFeyPriceQuote();
    assert.strictEqual(fetchCount, 1);
    assert.strictEqual(quote.source, "dexscreener");
    assert.strictEqual(quote.spotPriceUsd, SAMPLE_PRICE_USD);

    const delta = SAMPLE_PRICE_CHANGE_H6 / 100;
    const priceSixHoursAgo = SAMPLE_PRICE_USD / (1 + delta);
    const expectedTwap =
        (2 / 3) * SAMPLE_PRICE_USD + (1 / 3) * priceSixHoursAgo;
    const expectedUsed = (SAMPLE_PRICE_USD + expectedTwap) / 2;

    approxEqual(quote.twapPriceUsd, expectedTwap);
    approxEqual(quote.usedPriceUsd, expectedUsed);

    // Cached path should not refetch
    const cachedQuote = await client.getFeyPriceQuote();
    assert.strictEqual(fetchCount, 1);
    assert.strictEqual(cachedQuote, quote);

    const ticks = deriveTicksFromFeyUsdPrice({
        feyPriceUsd: quote.usedPriceUsd,
    });
    assert.strictEqual(ticks.tickLower, -46600);
    assert.strictEqual(ticks.tickUpper, -46600 + 110_400);
});

test("Static test of tick derivation", async (t) => {
    const client = new DexScreenerClient();
    const quote = await client.getFeyPriceQuote(true);
    assert.ok(quote.spotPriceUsd > 0, "spot price should be positive");
    assert.ok(quote.usedPriceUsd > 0, "used price should be positive");

    // 2.48m
    const ticks = deriveTicksFromFeyUsdPrice({
        feyPriceUsd: 0.000024812482489493697,
    });

    assert.equal(ticks.tickLower, -45200);
    assert.equal(ticks.tickUpper, 65200);
});

test("DexScreenerClient live snapshot logs price and ticks", async (t) => {
    const client = new DexScreenerClient();
    const quote = await client.getFeyPriceQuote(true);
    assert.ok(quote.spotPriceUsd > 0, "spot price should be positive");
    assert.ok(quote.usedPriceUsd > 0, "used price should be positive");

    const ticks = deriveTicksFromFeyUsdPrice({
        feyPriceUsd: quote.usedPriceUsd,
    });

    t.diagnostic(
        `Dexscreener spot=${quote.spotPriceUsd} TWAP=${quote.twapPriceUsd} used=${quote.usedPriceUsd}`
    );
    t.diagnostic(
        `Auto ticks tickLower=${ticks.tickLower} tickUpper=${ticks.tickUpper}`
    );

    assert.ok(
        Number.isFinite(ticks.tickLower) && Number.isFinite(ticks.tickUpper),
        "ticks should be finite numbers"
    );
});
