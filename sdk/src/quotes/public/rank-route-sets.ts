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
  mintA: Address;
  mintB: Address;
  vaultA: Address;
  vaultB: Address;
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
  n: number = 100,
) {
  const tA = performance.now();
  let routeSets = generateRouteSets(percentMap);
  console.log("GENERATE ROUTE SETS", performance.now() - tA, routeSets.length);

  // Run quick select algorithm to partition the topN results, mutating inplace
  partitionTopN(routeSets, n);
  return routeSets.slice(0, n).sort((a, b) => b.totalOut.cmp(a.totalOut));
}

export function partitionTopN(routeSets: RouteSet[], n: number = 100) {
  return quickselect(routeSets, n, 0, routeSets.length - 1, (a: RouteSet, b: RouteSet) => b.totalOut.cmp(a.totalOut));
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

// 
function quickselect(arr: any, k:any , left:any , right:any , compare: any) {
  quickselectStep(arr, k, left || 0, right || (arr.length - 1), compare || defaultCompare);
}

function quickselectStep(arr: any, k: any, left: any, right: any, compare: any ) {

  while (right > left) {
      if (right - left > 600) {
          var n = right - left + 1;
          var m = k - left + 1;
          var z = Math.log(n);
          var s = 0.5 * Math.exp(2 * z / 3);
          var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
          var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
          var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
          quickselectStep(arr, k, newLeft, newRight, compare);
      }

      var t = arr[k];
      var i = left;
      var j = right;

      swap(arr, left, k);
      if (compare(arr[right], t) > 0) swap(arr, left, right);

      while (i < j) {
          swap(arr, i, j);
          i++;
          j--;
          while (compare(arr[i], t) < 0) i++;
          while (compare(arr[j], t) > 0) j--;
      }

      if (compare(arr[left], t) === 0) swap(arr, left, j);
      else {
          j++;
          swap(arr, j, right);
      }

      if (j <= k) left = j + 1;
      if (k <= j) right = j - 1;
  }
}

function swap(arr: any, i: any, j: any) {
  var tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function defaultCompare(a: any, b: any) {
  return a < b ? -1 : a > b ? 1 : 0;
}