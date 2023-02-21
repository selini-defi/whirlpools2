import { TransactionBuilder, ZERO } from "@orca-so/common-sdk";
import { AccountInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { SwapUtils, TickArrayUtil, Whirlpool, WhirlpoolContext } from "../..";
import { cachedResolveOrCreateATAs } from "../../utils/ata-ix-util";
import { SwapInput, swapIx } from "../swap-ix";

export type SwapAsyncParams = {
  swapInput: SwapInput;
  whirlpool: Whirlpool;
  wallet: PublicKey;
};

/**
 * Swap instruction builder method with resolveATA & additional checks.
 * @param ctx - WhirlpoolContext object for the current environment.
 * @param params - {@link SwapAsyncParams}
 * @param refresh - If true, the network calls will always fetch for the latest values.
 * @returns
 */
export async function swapAsync(
  ctx: WhirlpoolContext,
  params: SwapAsyncParams,
  refresh: boolean,
  txBuilder: TransactionBuilder = new TransactionBuilder(ctx.connection, ctx.wallet)
): Promise<TransactionBuilder> {
  const { wallet, whirlpool, swapInput } = params;
  const data = whirlpool.getData();
  return swapAsyncFromKeys(
    ctx,
    wallet,
    swapInput,
    whirlpool.getAddress(),
    data.tokenMintA,
    data.tokenMintB,
    data.tokenVaultA,
    data.tokenVaultB,
    null,
    refresh,
    txBuilder
  );
}

export async function swapAsyncFromKeys(
  ctx: WhirlpoolContext,
  wallet: PublicKey,
  swapInput: SwapInput,
  whirlpool: PublicKey,
  tokenMintA: PublicKey,
  tokenMintB: PublicKey,
  tokenVaultA: PublicKey,
  tokenVaultB: PublicKey,
  atas: AccountInfo[] | null,
  refresh: boolean,
  txBuilder: TransactionBuilder = new TransactionBuilder(ctx.connection, ctx.wallet)
): Promise<TransactionBuilder> {
  const { aToB, amount } = swapInput;
  const tickArrayAddresses = [swapInput.tickArray0, swapInput.tickArray1, swapInput.tickArray2];

  let uninitializedArrays = await TickArrayUtil.getUninitializedArraysString(
    tickArrayAddresses,
    ctx.fetcher,
    refresh
  );
  if (uninitializedArrays) {
    throw new Error(`TickArray addresses - [${uninitializedArrays}] need to be initialized.`);
  }

  const [resolvedAtaA, resolvedAtaB] = await cachedResolveOrCreateATAs(
    wallet,
    [
      { tokenMint: tokenMintA, wrappedSolAmountIn: aToB ? amount : ZERO },
      { tokenMint: tokenMintB, wrappedSolAmountIn: !aToB ? amount : ZERO },
    ],
    () => ctx.fetcher.getAccountRentExempt(),
    (keys) => {
      if (atas != null) {
        return Promise.resolve(
          keys.map((key) =>
            atas.find((ata) => ata.address?.toBase58() === key.toBase58())
          ) as AccountInfo[]
        );
      } else {
        return ctx.fetcher.listTokenInfos(keys, false);
      }
    }
  );
  const { address: ataAKey, ...tokenOwnerAccountAIx } = resolvedAtaA;
  const { address: ataBKey, ...tokenOwnerAccountBIx } = resolvedAtaB;
  txBuilder.addInstructions([tokenOwnerAccountAIx, tokenOwnerAccountBIx]);
  const inputTokenAccount = aToB ? ataAKey : ataBKey;
  const outputTokenAccount = aToB ? ataBKey : ataAKey;

  return txBuilder.addInstruction(
    swapIx(
      ctx.program,
      SwapUtils.getSwapParamsFromQuoteKeys(
        swapInput,
        ctx,
        whirlpool,
        tokenVaultA,
        tokenVaultB,
        inputTokenAccount,
        outputTokenAccount,
        wallet
      )
    )
  );
}
