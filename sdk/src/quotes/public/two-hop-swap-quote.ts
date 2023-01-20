import { TwoHopSwapInput } from "../../instructions";
import { SwapEstimates, SwapQuote } from "./swap-quote";

/**
 * A collection of estimated values from quoting a swap.
 * @category Quotes
 * @link {BaseSwapQuote}
 * @link {DevFeeSwapQuote}
 */
export type TwoHopSwapQuote = NormalTwoHopSwapQuote; // TODO dev swap

/**
 * A collection of estimated values from quoting a swap.
 * @category Quotes
 * @param estimatedAmountIn - Approximate number of input token swapped in the swap
 * @param estimatedAmountOut - Approximate number of output token swapped in the swap
 * @param estimatedEndTickIndex - Approximate tick-index the Whirlpool will land on after this swap
 * @param estimatedEndSqrtPrice - Approximate sqrtPrice the Whirlpool will land on after this swap
 * @param estimatedFeeAmount - Approximate feeAmount (all fees) charged on this swap
 */
export type NormalTwoHopSwapQuote = {
  swapOneEstimates: SwapEstimates,
  swapTwoEstimates: SwapEstimates,
} & TwoHopSwapInput;

export function twoHopSwapQuoteFromSwapQuotes(
  swapQuoteOne: SwapQuote,
  swapQuoteTwo: SwapQuote,
): TwoHopSwapQuote {
  const amountSpecifiedIsInput = swapQuoteOne.amountSpecifiedIsInput;
  // If amount specified is input, then we care about input of the first swap
  // otherwise we care about output of the second swap
  let [amount, otherAmountThreshold] = amountSpecifiedIsInput 
    ? [swapQuoteOne.amount, swapQuoteTwo.otherAmountThreshold]
    : [swapQuoteTwo.amount, swapQuoteOne.otherAmountThreshold];

  return {
    amount,
    otherAmountThreshold,
    amountSpecifiedIsInput,
    aToBOne: swapQuoteOne.aToB,
    aToBTwo: swapQuoteTwo.aToB,
    sqrtPriceLimitOne: swapQuoteOne.sqrtPriceLimit,
    sqrtPriceLimitTwo: swapQuoteTwo.sqrtPriceLimit,
    tickArrayOne0: swapQuoteOne.tickArray0,
    tickArrayOne1: swapQuoteOne.tickArray1,
    tickArrayOne2: swapQuoteOne.tickArray2,
    tickArrayTwo0: swapQuoteTwo.tickArray0,
    tickArrayTwo1: swapQuoteTwo.tickArray1,
    tickArrayTwo2: swapQuoteTwo.tickArray2,
    swapOneEstimates: { ...swapQuoteOne },
    swapTwoEstimates: { ...swapQuoteTwo },
  };
}
