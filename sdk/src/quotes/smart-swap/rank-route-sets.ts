import { u64 } from "@solana/spl-token";
import { kSmallestPartition } from "../../utils/math/k-smallest-partition";
import { RouteQuote, WhirlpoolRoute } from "../public/smart-swap-types";

export interface QuotePercentMap {
  [key: number]: RouteQuote[];
}

export function getRouteCompareFn(amountSpecifiedIsInput: boolean) {
  return amountSpecifiedIsInput ? routesCompareForInputAmount : routesCompareForOutputAmount;
}

function routesCompareForInputAmount(a: WhirlpoolRoute, b: WhirlpoolRoute) {
  return b.totalOut.cmp(a.totalOut);
}

function routesCompareForOutputAmount(a: WhirlpoolRoute, b: WhirlpoolRoute) {
  return a.totalIn.cmp(b.totalIn);
}

export function getRankedRoutes(
  percentMap: QuotePercentMap,
  amountSpecifiedIsInput: boolean,
  topN: number,
  maxSplits: number
) {
  let routes = generateRoutes(percentMap, maxSplits);

  // Run quick select algorithm to partition the topN results, mutating inplace
  const partitionSize = Math.min(topN, routes.length - 1);
  const routeCompare = getRouteCompareFn(amountSpecifiedIsInput);
  kSmallestPartition(routes, partitionSize, 0, routes.length - 1, routeCompare);
  return routes.slice(0, partitionSize).sort(routeCompare);
}

export function generateRoutes(percentMap: QuotePercentMap, maxSplits: number) {
  let routes: WhirlpoolRoute[] = [];
  buildRoutes(
    percentMap,
    maxSplits,
    {
      quotes: [],
      percent: 0,
      totalIn: new u64(0),
      totalOut: new u64(0),
    },
    routes
  );
  return routes;
}

/**
 * @param quotePercentMap Map from percentage of flow to their quotes
 * @param currentRoute The currently being considered route set
 * @param routes Array of all valid route sets
 */
function buildRoutes(
  quotePercentMap: QuotePercentMap,
  maxSplits: number,
  currentRoute: WhirlpoolRoute,
  routes: WhirlpoolRoute[]
) {
  const { percent, quotes } = currentRoute;
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
      const nextRoute = {
        quotes: [...quotes, nextQuote],
        percent: newPercentTotal,
        totalIn: currentRoute.totalIn.add(nextQuote.amountIn),
        totalOut: currentRoute.totalOut.add(nextQuote.amountOut),
      };

      // Remove the current and prior routes from consideration
      const nextCandidateQuotes = nextPercentQuotes.slice(j + 1);

      if (newPercentTotal === 100) {
        // If we have reached 100% flow routed, we add it to the set of valid route sets
        routes.push(nextRoute);
      } else if (quotes.length + 1 != maxSplits) {
        // Otherwise, recursively build route sets
        buildRoutes(
          {
            ...quotePercentMap,
            [nextPercent]: nextCandidateQuotes,
          },
          maxSplits,
          nextRoute,
          routes
        );
      }
    }
  }
}
