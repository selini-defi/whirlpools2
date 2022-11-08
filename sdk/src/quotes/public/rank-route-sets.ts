import { Address } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { SwapQuote } from "./swap-quote";

export interface RouteQuote {
  // An array of pools (id-ed by PoolKey) to complete an exchange between tokenA -> tokenB
  route: string[];
  percent: number;
  amountIn: u64;
  amountOut: u64;
  calculatedHops: RouteHop[];
}

export interface RouteHop {
  percent: number;
  amountIn: u64;
  amountOut: u64;
  whirlpool: Address;
  inputMint: Address;
  outputMint: Address;
  quote: SwapQuote;
}

export interface RouteSet {
  quotes: RouteQuote[];
  percent: number;
  totalOut: u64;
}

export interface QuotePercentMap {
  [key: number]: RouteQuote[];
}

export function getRankedRouteSets(
  percentMap: QuotePercentMap,
  topN: number = 5,
) {
  let routeSets = generateRouteSets(percentMap);

  // Sort by route sets with the most values
  routeSets = routeSets.sort((a, b) => b.totalOut.cmp(a.totalOut));
  return routeSets.slice(0, topN);
}

export function generateRouteSets(percentMap: QuotePercentMap) {
  let routeSets: RouteSet[] = [];
  buildRouteSet(
    percentMap,
    {
      quotes: [],
      percent: 0,
      totalOut: new u64(0),
    },
    routeSets
  );
  return routeSets;
}

/**
 * @param quotePercentMap Map from percentage of flow to their quotes
 * @param currentRouteSet The currently being considered route set
 * @param routeSets Array of all valid route sets
 */
function buildRouteSet(
  quotePercentMap: QuotePercentMap,
  currentRouteSet: RouteSet,
  routeSets: RouteSet[],
) {
  const { percent, quotes } = currentRouteSet;
  const percents = Object.keys(quotePercentMap).map(percent => Number(percent));
  for (let i = percents.length - 1; i >= 0; i--) {
    const nextPercent = percents[i];
    const newPercentTotal = percent + nextPercent;

    // Optimization to prevent exceeding 100% flow and excess combinations of flow by only using decreasing
    // amounts of flow percentages
    const nextPercentIsSmaller = quotes.length > 0 && nextPercent > quotes[quotes.length - 1].percent;
    if (newPercentTotal > 100 || nextPercentIsSmaller) {
      continue;
    }

    const nextPercentQuotes = quotePercentMap[nextPercent];
    for (let j = 0; j < nextPercentQuotes.length; j++) {
      const nextQuote = nextPercentQuotes[j];

      // Don't use a quote that shares a pool with an existing quote
      const hasReusedPools = nextQuote.route.some((r1) =>
        currentRouteSet.quotes.some((r2) => r2.route.some((r3) => r3.indexOf(r1) !== -1))
      );
      if (hasReusedPools) {
        continue;
      }

      // todo: Doesn't take into transaction fees
      // double-hops, multi-route penalties, benefits for pairs that can share lookup tables
      const nextRouteSet = {
        quotes: [...currentRouteSet.quotes, nextQuote],
        percent: newPercentTotal,
        totalOut: currentRouteSet.totalOut.add(nextQuote.amountOut),
      };

      // Remove the current and prior routes from consideration
      const nextCandidateQuotes = nextPercentQuotes.slice(j + 1);

      if (newPercentTotal === 100) {
        // If we have reached 100% flow routed, we add it to the set of valid route sets
        routeSets.push(nextRouteSet);
      } else {
        // Otherwise, recursively build route sets
        buildRouteSet(
          {
            ...quotePercentMap,
            [nextPercent]: nextCandidateQuotes,
          },
          nextRouteSet,
          routeSets
        );
      }
    }
  }
}
