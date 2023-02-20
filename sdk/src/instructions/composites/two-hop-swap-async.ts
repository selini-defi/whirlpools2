import { resolveOrCreateATAs, TransactionBuilder, ZERO } from "@orca-so/common-sdk";
import { PublicKey } from "@solana/web3.js";
import { PDAUtil, TickArrayUtil, TwoHopSwapInput, Whirlpool, WhirlpoolContext } from "../..";
import { twoHopSwapIx } from "../two-hop-swap-ix";

export type TwoHopSwapAsyncParams = {
  swapInput: TwoHopSwapInput;
  whirlpoolOne: Whirlpool;
  whirlpoolTwo: Whirlpool;
  wallet: PublicKey;
};

/**
 * Swap instruction builder method with resolveATA & additional checks.
 * @param ctx - WhirlpoolContext object for the current environment.
 * @param params - {@link TwoHopSwapAsyncParams}
 * @param refresh - If true, the network calls will always fetch for the latest values.
 * @returns
 */
export async function twoHopSwapAsync(
  ctx: WhirlpoolContext,
  params: TwoHopSwapAsyncParams,
  refresh: boolean,
  txBuilder: TransactionBuilder = new TransactionBuilder(ctx.connection, ctx.wallet)
): Promise<TransactionBuilder> {
  const { wallet, whirlpoolOne, whirlpoolTwo, swapInput } = params;
  const { aToBOne, aToBTwo, amount } = swapInput;

  const tickArrayAddresses = [
    swapInput.tickArrayOne0,
    swapInput.tickArrayOne1,
    swapInput.tickArrayOne2,
    swapInput.tickArrayTwo0,
    swapInput.tickArrayTwo1,
    swapInput.tickArrayTwo2,
  ];

  let uninitializedArrays = await TickArrayUtil.getUninitializedArraysString(
    tickArrayAddresses,
    ctx.fetcher,
    refresh
  );
  if (uninitializedArrays) {
    throw new Error(`TickArray addresses - [${uninitializedArrays}] need to be initialized.`);
  }

  const dataOne = whirlpoolOne.getData();
  const dataTwo = whirlpoolOne.getData();
  // TODO: Resolve atas here
  const [resolvedAtaA, resolvedAtaB] = await resolveOrCreateATAs(
    ctx.connection,
    wallet,
    [
      { tokenMint: dataOne.tokenMintA, wrappedSolAmountIn: aToBOne ? amount : ZERO },
      { tokenMint: dataOne.tokenMintB, wrappedSolAmountIn: !aToBOne ? amount : ZERO },
    ],
    () => ctx.fetcher.getAccountRentExempt()
  );
  const { address: ataAKey, ...tokenOwnerAccountAIx } = resolvedAtaA;
  const { address: ataBKey, ...tokenOwnerAccountBIx } = resolvedAtaB;
  txBuilder.addInstructions([tokenOwnerAccountAIx, tokenOwnerAccountBIx]);
  const inputTokenAccount = aToBOne ? ataAKey : ataBKey;
  const outputTokenAccount = aToBOne ? ataBKey : ataAKey;

  const oracleOne = PDAUtil.getOracle(ctx.program.programId, whirlpoolOne.getAddress()).publicKey;
  const oracleTwo = PDAUtil.getOracle(ctx.program.programId, whirlpoolTwo.getAddress()).publicKey;

  return txBuilder.addInstruction(
    twoHopSwapIx(ctx.program, {
      ...swapInput,
      whirlpoolOne: whirlpoolOne.getAddress(),
      whirlpoolTwo: whirlpoolTwo.getAddress(),
      // TODO: handle ATAs
      tokenOwnerAccountOneA: null as any,
      tokenOwnerAccountOneB: null as any,
      tokenOwnerAccountTwoA: null as any,
      tokenOwnerAccountTwoB: null as any,
      tokenVaultOneA: dataOne.tokenVaultA,
      tokenVaultOneB: dataOne.tokenVaultB,
      tokenVaultTwoA: dataTwo.tokenVaultA,
      tokenVaultTwoB: dataTwo.tokenVaultB,
      oracleOne,
      oracleTwo,
      tokenAuthority: wallet,
    })
  );
}
