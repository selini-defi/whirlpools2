import { AddressUtil, Percentage } from "@orca-so/common-sdk";
import { Address } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { AccountFetcher } from "../..";
import { batchSwapQuoteByToken, swapQuoteWithParams } from "./swap-quote";
import { PoolWalks, TokenPairPool, getRouteId } from "./pool-graph";
import { getRankedRouteSets, RouteQuote } from "./rank-route-sets";

export async function findBestRoutes(
  inputTokenMint: string,
  outputTokenMint: string,
  inputAmount: u64,
  walks: PoolWalks,
  pools: Record<string, TokenPairPool>,
  programId: Address,
  fetcher: AccountFetcher,
  percentIncrement: number = 10,
) {
  const pairRoutes = walks[getRouteId(inputTokenMint, outputTokenMint)];
  if (!pairRoutes || inputAmount.isZero()) {
    return [];
  }

  const quoteMap: Record<number, Array<Pick<RouteQuote, "route" | "percent" | "calculatedHops">>> = {};
  const { percents, amounts } = generatePercentageAmounts(inputAmount, percentIncrement);
  // The max route length is the number of iterations of quoting that we need to do
  const maxRouteLength = Math.max(...pairRoutes.map((route) => route.length));

  // For hop 0 of all routes, get swap quotes using [inputAmount, inputTokenMint]
  // For hop 1..n of all routes, get swap quotes using [outputAmount, outputTokenMint] of hop n-1 as input
  for (let hop = 0; hop < maxRouteLength; hop++) {
    // Each batch of quotes needs to be iterative
    const quoteUpdates = [];
    for (let amountIndex = 0; amountIndex < amounts.length; amountIndex++) {
      const percent = percents[amountIndex];
      const amountIn = amounts[amountIndex];

      // Initialize quote map for first hop
      if (hop === 0) {
        quoteMap[percent] = [];
      }

      // Iterate over all routes
      for (let routeIndex = 0; routeIndex < pairRoutes.length; routeIndex++) {
        const route = pairRoutes[routeIndex];
        // If the current route is already complete, don't do anything
        if (route.length <= hop) {
          continue;
        }

        // If this is the first hop of the route, initialize the quote map
        if (hop === 0) {
          quoteMap[percent].push({
            percent,
            route,
            calculatedHops: [],
          });
        }
        const currentQuote = quoteMap[percent][routeIndex];
        const initialPool = pools[route[0]];

        // TODO: we could pre-sort the routes here to not have to constantly reverse the routes
        let orderedRoute = route;

        // If either of the initial hop's token mints aren't the inputTokenMint, then we need to reverse the route
        if (
          AddressUtil.toPubKey(initialPool.tokenMintA).toBase58() !== inputTokenMint &&
          AddressUtil.toPubKey(initialPool.tokenMintB).toBase58() !== inputTokenMint
        ) {
          orderedRoute = [...route].reverse();
        }

        const pool = pools[orderedRoute[hop]];
        const lastHop = currentQuote.calculatedHops[hop - 1];
        // If we were unable to get a quote from the last hop, this is an invalid route
        if (hop !== 0 && !lastHop) {
          continue;
        }

        // If this is the first hop, use the input mint and amount, otherwise use the output of the last hop
        const [tokenAmountIn, input] = hop === 0
          ? [amountIn, inputTokenMint]
          : [lastHop.amountOut, lastHop.outputMint];

        quoteUpdates.push({
          percent,
          routeIndex,
          quoteIndex: quoteUpdates.length,
          address: pool.address,
          request: {
            whirlpool: pool.address,
            inputTokenMint: input,
            tokenAmount: tokenAmountIn,
            amountSpecifiedIsInput: true,
          },
        });
      }
    }

    const params = await batchSwapQuoteByToken(
      quoteUpdates.map(update => update.request),
      AddressUtil.toPubKey(programId),
      fetcher,
      false
    );

    for (const { address, percent, routeIndex, quoteIndex } of quoteUpdates) {
      const param = params[quoteIndex];
      const route = quoteMap[percent][routeIndex];
      try {
        const quote = swapQuoteWithParams(param, Percentage.fromFraction(0, 1000));
        const { whirlpoolData, tokenAmount, aToB, amountSpecifiedIsInput } = param;
        const [poolA, poolB] = [
          whirlpoolData.tokenMintA.toBase58(),
          whirlpoolData.tokenMintB.toBase58(),
        ];
        const [inputMint, outputMint] =
          aToB && amountSpecifiedIsInput ? [poolA, poolB] : [poolB, poolA];
        route.calculatedHops.push({
          percent,
          amountIn: tokenAmount,
          amountOut: quote.otherAmountThreshold,
          whirlpool: address,
          inputMint,
          outputMint,
          quote,
        });
      } catch (e) {
        continue;
      }
    }
  }

  const cleanedQuoteMap = cleanQuoteMap(inputAmount, quoteMap);
  return getRankedRouteSets(cleanedQuoteMap);
}

function cleanQuoteMap(
  inputAmount: u64,
  quoteMap: Record<number, Array<Pick<RouteQuote, "route" | "percent" | "calculatedHops">>>,
) {
  const percents = Object.keys(quoteMap).map(percent => Number(percent));
  const cleanedPercentMap: { [key: number]: RouteQuote[] } = {};
  for (let i = 0; i < percents.length; i++) {
    const percent = percents[i];
    const uncleanedQuotes = quoteMap[percent];
    cleanedPercentMap[percent] = [];
    for (const { route, calculatedHops } of uncleanedQuotes) {
      if (calculatedHops.length === route.length) {
        cleanedPercentMap[percent].push({
          percent,
          route,
          amountIn: inputAmount,
          amountOut: calculatedHops[calculatedHops.length - 1].amountOut,
          calculatedHops,
        });
      }
    }
  }
  return cleanedPercentMap;
}

function generatePercentageAmounts(inputAmount: u64, minPercent: number = 5) {
  const percents = [];
  const amounts = [];

  for (let i = 1; i <= 100 / minPercent; i++) {
    percents.push(i * minPercent);
    amounts.push(inputAmount.mul(new u64(i * minPercent)).div(new u64(100)));
  }

  return { percents, amounts };
}
