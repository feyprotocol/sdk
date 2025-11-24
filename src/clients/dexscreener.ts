const DEFAULT_FEY_PAIR_URL =
    "https://api.dexscreener.com/latest/dex/pairs/base/0xe155c517c53f078f4b443c99436e42c1b80fd2fb1b3508f431c46b8365e4f3f0";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_HOURLY_CHANGE_PCT = 60;
const MAX_SPOT_DEVIATION_RATIO = 0.25;

type FetchLike =
    | typeof fetch
    | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>);

export type DexScreenerPriceChange = {
    h1?: number;
    h6?: number;
    h24?: number;
};

export type DexScreenerPair = {
    priceUsd?: string;
    priceNative?: string;
    volume?: Record<string, number>;
    priceChange?: DexScreenerPriceChange;
    pairAddress?: string;
    chainId?: string;
    dexId?: string;
    pairCreatedAt?: number;
};

export type DexScreenerResponse = {
    schemaVersion?: string;
    pairs?: DexScreenerPair[];
    pair?: DexScreenerPair;
};

export type FeyPriceQuote = {
    spotPriceUsd: number;
    twapPriceUsd: number;
    usedPriceUsd: number;
    fetchedAt: number;
    source: "dexscreener";
    priceChange?: DexScreenerPriceChange;
};

export type DexScreenerClientOptions = {
    url?: string;
    timeoutMs?: number;
    cacheTtlMs?: number;
    fetchFn?: FetchLike;
    volatilityGuard?: {
        maxHourlyChangePct?: number;
        maxSpotDeviationRatio?: number;
    };
};

export class DexScreenerClient {
    private readonly url: string;
    private readonly timeoutMs: number;
    private readonly cacheTtlMs: number;
    private readonly fetchFn: FetchLike;
    private readonly volatilityGuard: {
        maxHourlyChangePct: number;
        maxSpotDeviationRatio: number;
    };
    private cachedQuote?: { quote: FeyPriceQuote; fetchedAt: number };

    constructor(options: DexScreenerClientOptions = {}) {
        this.url = options.url ?? DEFAULT_FEY_PAIR_URL;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.cacheTtlMs = Math.max(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS, 0);
        const fallbackFetch = (globalThis as any)?.fetch as
            | FetchLike
            | undefined;
        this.fetchFn = (options.fetchFn ?? fallbackFetch)!;

        if (typeof this.fetchFn !== "function") {
            throw new Error(
                "Global fetch is not available. Provide a fetch implementation via DexScreenerClientOptions."
            );
        }

        this.volatilityGuard = {
            maxHourlyChangePct:
                options.volatilityGuard?.maxHourlyChangePct ??
                MAX_HOURLY_CHANGE_PCT,
            maxSpotDeviationRatio:
                options.volatilityGuard?.maxSpotDeviationRatio ??
                MAX_SPOT_DEVIATION_RATIO,
        };
    }

    async getFeyPriceQuote(forceRefresh = false): Promise<FeyPriceQuote> {
        if (!forceRefresh && this.cachedQuote) {
            const age = Date.now() - this.cachedQuote.fetchedAt;
            if (age <= this.cacheTtlMs) {
                return this.cachedQuote.quote;
            }
        }

        const pair = await this.fetchLatestPair();
        const price = this.extractUsdPrice(pair);
        const twap = this.computeFourHourTwap(price, pair.priceChange?.h6);
        const usedPrice = this.applyVolatilityGuards(
            price,
            twap,
            pair.priceChange
        );

        const quote: FeyPriceQuote = {
            spotPriceUsd: price,
            twapPriceUsd: twap,
            usedPriceUsd: usedPrice,
            fetchedAt: Date.now(),
            source: "dexscreener",
            priceChange: pair.priceChange,
        };

        this.cachedQuote = { quote, fetchedAt: quote.fetchedAt };
        return quote;
    }

    private async fetchLatestPair(): Promise<DexScreenerPair> {
        const controller =
            typeof AbortController !== "undefined"
                ? new AbortController()
                : undefined;
        const timeout =
            controller &&
            setTimeout(() => {
                controller.abort();
            }, this.timeoutMs);

        try {
            const response = await this.fetchFn(this.url, {
                method: "GET",
                headers: { accept: "application/json" },
                signal: controller?.signal,
            });
            if (!response.ok) {
                throw new Error(
                    `Dexscreener responded with ${response.status} ${response.statusText}`
                );
            }
            const body = (await response.json()) as DexScreenerResponse;
            const pair = body.pair ?? body.pairs?.[0];
            if (!pair) {
                throw new Error("Dexscreener response did not include a pair");
            }
            return pair;
        } catch (error) {
            if ((error as Error).name === "AbortError") {
                throw new Error(
                    `Dexscreener request timed out after ${this.timeoutMs}ms`
                );
            }
            throw error;
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    private extractUsdPrice(pair: DexScreenerPair): number {
        const parsed = Number(pair.priceUsd);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("Dexscreener returned an invalid FEY price");
        }
        return parsed;
    }

    private computeFourHourTwap(priceUsd: number, h6Change?: number): number {
        if (!Number.isFinite(h6Change) || h6Change === undefined) {
            return priceUsd;
        }
        const delta = h6Change / 100;
        if (delta <= -1) {
            return priceUsd;
        }
        const priceSixHoursAgo = priceUsd / (1 + delta);
        const twap = (2 / 3) * priceUsd + (1 / 3) * priceSixHoursAgo;
        return twap;
    }

    private applyVolatilityGuards(
        spot: number,
        twap: number,
        change?: DexScreenerPriceChange
    ): number {
        const hourly = change?.h1;
        if (
            Number.isFinite(hourly) &&
            Math.abs(hourly as number) > this.volatilityGuard.maxHourlyChangePct
        ) {
            throw new Error(
                `FEY price volatility too high (|h1|=${hourly}%) to derive ticks safely`
            );
        }

        if (!Number.isFinite(twap) || twap <= 0) {
            return spot;
        }

        const deviation = Math.abs(spot - twap) / twap;
        if (deviation > this.volatilityGuard.maxSpotDeviationRatio) {
            return twap;
        }

        return (spot + twap) / 2;
    }
}

