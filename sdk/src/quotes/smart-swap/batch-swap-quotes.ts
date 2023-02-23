import { AddressUtil } from "@orca-so/common-sdk";
import { Address } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { AccountFetcher } from "../..";
import { PoolUtil, SwapDirection, SwapUtils } from "../../utils/public";
import { SwapQuoteParam } from "../public";

interface SwapQuoteRequest {
  whirlpool: Address;
  tradeTokenMint: Address;
  tokenAmount: u64;
  amountSpecifiedIsInput: boolean;
}

export async function batchBuildSwapQuoteParams(
  quoteRequests: SwapQuoteRequest[],
  programId: Address,
  fetcher: AccountFetcher,
  refresh: boolean
): Promise<SwapQuoteParam[]> {
  const whirlpools = await fetcher.listPools(
    quoteRequests.map((req) => req.whirlpool),
    refresh
  );
  const program = AddressUtil.toPubKey(programId);

  const tickArrayRequests = quoteRequests.map((quoteReq, index) => {
    const { whirlpool, tokenAmount, tradeTokenMint, amountSpecifiedIsInput } = quoteReq;
    const whirlpoolData = whirlpools[index]!;
    const swapMintKey = AddressUtil.toPubKey(tradeTokenMint);
    const swapTokenType = PoolUtil.getTokenType(whirlpoolData, swapMintKey);
    invariant(!!swapTokenType, "swapTokenMint does not match any tokens on this pool");
    const aToB =
      SwapUtils.getSwapDirection(whirlpoolData, swapMintKey, amountSpecifiedIsInput) ===
      SwapDirection.AtoB;
    return {
      whirlpoolData,
      tokenAmount,
      aToB,
      tickCurrentIndex: whirlpoolData.tickCurrentIndex,
      tickSpacing: whirlpoolData.tickSpacing,
      whirlpoolAddress: AddressUtil.toPubKey(whirlpool),
      amountSpecifiedIsInput,
    };
  });

  const tickArrays = await SwapUtils.getBatchTickArrays(
    program,
    fetcher,
    refresh,
    tickArrayRequests
  );

  return tickArrayRequests.map((req, index) => {
    const { whirlpoolData, tokenAmount, aToB, amountSpecifiedIsInput } = req;
    return {
      whirlpoolData,
      tokenAmount,
      aToB,
      amountSpecifiedIsInput,
      sqrtPriceLimit: SwapUtils.getDefaultSqrtPriceLimit(aToB),
      otherAmountThreshold: SwapUtils.getDefaultOtherAmountThreshold(amountSpecifiedIsInput),
      tickArrays: tickArrays[index],
    };
  });
}
