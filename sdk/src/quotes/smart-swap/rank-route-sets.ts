import { u64 } from "@solana/spl-token";
import { kSmallestPartition } from "../../utils/math/k-smallest-partition";
import { RouteQuote, WhirlpoolRoute } from "../public/smart-swap-types";

export interface QuotePercentMap {
  [key: number]: RouteQuote[];
}

export function getRouteSetCompare(amountSpecifiedIsInput: boolean) {
  return amountSpecifiedIsInput ? routeSetCompareForInputAmount : routeSetCompareForOutputAmount;
}

function routeSetCompareForInputAmount(a: WhirlpoolRoute, b: WhirlpoolRoute) {
  return b.totalOut.cmp(a.totalOut);
}

function routeSetCompareForOutputAmount(a: WhirlpoolRoute, b: WhirlpoolRoute) {
  return a.totalIn.cmp(b.totalIn);
}

export function getRankedRouteSets(
  percentMap: QuotePercentMap,
  amountSpecifiedIsInput: boolean,
  topN: number,
  maxSplits: number
) {
  let routeSets = generateRouteSets(percentMap, maxSplits);

  // Run quick select algorithm to partition the topN results, mutating inplace
  const partitionSize = Math.min(topN, routeSets.length - 1);
  const routeSetCompare = getRouteSetCompare(amountSpecifiedIsInput);

  if (partitionSize < routeSets.length) {
    return routeSets.sort(routeSetCompare);
  }

  kSmallestPartition(routeSets, partitionSize, 0, routeSets.length - 1, routeSetCompare);
  return routeSets.slice(0, partitionSize).sort(routeSetCompare);
}

export function generateRouteSets(percentMap: QuotePercentMap, maxSplits: number) {
  let routeSets: WhirlpoolRoute[] = [];
  buildRouteSet(
    percentMap,
    maxSplits,
    {
      quotes: [],
      percent: 0,
      totalIn: new u64(0),
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
  maxSplits: number,
  currentRouteSet: WhirlpoolRoute,
  routeSets: WhirlpoolRoute[]
) {
  const { percent, quotes } = currentRouteSet;
  const percents = Object.keys(quotePercentMap).map((percent) => Number(percent));
  for (let i = percents.length - 1; i >= 0; i--) {
    const nextPercent = percents[i];
    const newPercentTotal = percent + nextPercent;

    // Optimization to prevent exceeding 100% flow and excess combinations of flow by only using decreasing
    // amounts of flow percentages
    const nextPercentIsSmaller =
      quotes.length > 0 && nextPercent > quotes[quotes.length - 1].percent;
    if (newPercentTotal > 100 || nextPercentIsSmaller) {
      continue;
    }

    const nextPercentQuotes = quotePercentMap[nextPercent];
    for (let j = 0; j < nextPercentQuotes.length; j++) {
      const nextQuote = nextPercentQuotes[j];

      // Don't use a quote that shares a pool with an existing quote
      const hasReusedPools = nextQuote.route.some((r1) =>
        quotes.some((r2) => r2.route.some((r3) => r3.indexOf(r1) !== -1))
      );
      if (hasReusedPools) {
        continue;
      }

      // todo: Doesn't take into transaction fees
      // double-hops, multi-route penalties, benefits for pairs that can share lookup tables
      const nextRouteSet = {
        quotes: [...quotes, nextQuote],
        percent: newPercentTotal,
        totalIn: currentRouteSet.totalIn.add(nextQuote.amountIn),
        totalOut: currentRouteSet.totalOut.add(nextQuote.amountOut),
      };

      // Remove the current and prior routes from consideration
      const nextCandidateQuotes = nextPercentQuotes.slice(j + 1);

      if (newPercentTotal === 100) {
        // If we have reached 100% flow routed, we add it to the set of valid route sets
        routeSets.push(nextRouteSet);
      } else if (quotes.length + 1 != maxSplits) {
        // Otherwise, recursively build route sets
        buildRouteSet(
          {
            ...quotePercentMap,
            [nextPercent]: nextCandidateQuotes,
          },
          maxSplits,
          nextRouteSet,
          routeSets
        );
      }
    }
  }
}
