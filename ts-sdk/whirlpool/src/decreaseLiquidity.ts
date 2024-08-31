import type { Whirlpool } from "@orca-so/whirlpools-client";
import {
  fetchAllTickArray,
  fetchPosition,
  fetchWhirlpool,
  getClosePositionInstruction,
  getCollectFeesInstruction,
  getCollectRewardInstruction,
  getDecreaseLiquidityInstruction,
  getPositionAddress,
  getTickArrayAddress,
} from "@orca-so/whirlpools-client";
import type {
  CollectFeesQuote,
  CollectRewardsQuote,
  DecreaseLiquidityQuote,
  TickRange,
} from "@orca-so/whirlpools-core";
import {
  _MAX_TICK_INDEX,
  _MIN_TICK_INDEX,
  getTickArrayStartTickIndex,
  decreaseLiquidityQuote,
  decreaseLiquidityQuoteA,
  decreaseLiquidityQuoteB,
  collectFeesQuote,
  collectRewardsQuote,
} from "@orca-so/whirlpools-core";
import type {
  Address,
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  GetMultipleAccountsApi,
  IInstruction,
  Rpc,
  TransactionPartialSigner,
} from "@solana/web3.js";
import {
  DEFAULT_ADDRESS,
  DEFAULT_FUNDER,
  DEFAULT_SLIPPAGE_TOLERANCE,
} from "./config";
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import invariant from "tiny-invariant";
import { prepareTokenAccountsInstructions } from "./token";

// TODO: allow specify number as well as bigint
// TODO: transfer hook
// TODO: transfer fee

type DecreaseLiquidityQuoteParam =
  | {
      liquidity: bigint;
    }
  | {
      tokenA: bigint;
    }
  | {
      tokenB: bigint;
    };

type DecreaseLiquidityInstructions = {
  quote: DecreaseLiquidityQuote;
  instructions: IInstruction[];
};

function getDecreaseLiquidityQuote(
  param: DecreaseLiquidityQuoteParam,
  pool: Whirlpool,
  tickRange: TickRange,
  slippageTolerance: number,
): DecreaseLiquidityQuote {
  const slippageToleranceBps = Math.floor(slippageTolerance * 10000);
  if ("liquidity" in param) {
    return decreaseLiquidityQuote(
      param.liquidity,
      slippageToleranceBps,
      pool.tickCurrentIndex,
      tickRange.tickLowerIndex,
      tickRange.tickUpperIndex,
    );
  } else if ("tokenA" in param) {
    return decreaseLiquidityQuoteA(
      param.tokenA,
      slippageToleranceBps,
      pool.tickCurrentIndex,
      tickRange.tickLowerIndex,
      tickRange.tickUpperIndex,
    );
  } else {
    return decreaseLiquidityQuoteB(
      param.tokenB,
      slippageToleranceBps,
      pool.tickCurrentIndex,
      tickRange.tickLowerIndex,
      tickRange.tickUpperIndex,
    );
  }
}

export async function decreaseLiquidityInstructions(
  rpc: Rpc<
    GetAccountInfoApi &
      GetMultipleAccountsApi &
      GetMinimumBalanceForRentExemptionApi
  >,
  positionMint: Address,
  param: DecreaseLiquidityQuoteParam,
  slippageTolerance: number = DEFAULT_SLIPPAGE_TOLERANCE,
  authority: TransactionPartialSigner = DEFAULT_FUNDER,
): Promise<DecreaseLiquidityInstructions> {
  invariant(
    authority.address !== DEFAULT_ADDRESS,
    "Either supply the authority or set the default funder",
  );

  const positionAddress = await getPositionAddress(positionMint);
  const position = await fetchPosition(rpc, positionAddress[0]);
  const whirlpool = await fetchWhirlpool(rpc, position.data.whirlpool);
  const quote = getDecreaseLiquidityQuote(
    param,
    whirlpool.data,
    position.data,
    slippageTolerance,
  );
  const instructions: IInstruction[] = [];

  const lowerTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickLowerIndex,
    whirlpool.data.tickSpacing,
  );
  const upperTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickUpperIndex,
    whirlpool.data.tickSpacing,
  );

  const [positionTokenAccount, tickArrayLower, tickArrayUpper] =
    await Promise.all([
      findAssociatedTokenPda({
        owner: authority.address,
        mint: positionMint,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }).then((x) => x[0]),
      getTickArrayAddress(whirlpool.address, lowerTickArrayStartIndex).then(
        (x) => x[0],
      ),
      getTickArrayAddress(whirlpool.address, upperTickArrayStartIndex).then(
        (x) => x[0],
      ),
    ]);

  const { createInstructions, cleanupInstructions, tokenAccountAddresses } =
    await prepareTokenAccountsInstructions(rpc, authority, [
      whirlpool.data.tokenMintA,
      whirlpool.data.tokenMintB,
    ]);

  instructions.push(...createInstructions);

  instructions.push(
    getDecreaseLiquidityInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: position.address,
      positionTokenAccount,
      tokenOwnerAccountA: tokenAccountAddresses[whirlpool.data.tokenMintA],
      tokenOwnerAccountB: tokenAccountAddresses[whirlpool.data.tokenMintB],
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
      tickArrayLower,
      tickArrayUpper,
      liquidityAmount: quote.liquidityDelta,
      tokenMinA: quote.tokenMinA,
      tokenMinB: quote.tokenMinB,
    }),
  );

  instructions.push(...cleanupInstructions);

  return { quote, instructions };
}

type ClosePositionInstructions = DecreaseLiquidityInstructions & {
  feesQuote: CollectFeesQuote;
  rewardsQuote: CollectRewardsQuote;
};

export async function closePositionInstructions(
  rpc: Rpc<
    GetAccountInfoApi &
      GetMultipleAccountsApi &
      GetMinimumBalanceForRentExemptionApi
  >,
  positionMint: Address,
  param: DecreaseLiquidityQuoteParam,
  slippageTolerance: number = DEFAULT_SLIPPAGE_TOLERANCE,
  authority: TransactionPartialSigner = DEFAULT_FUNDER,
): Promise<ClosePositionInstructions> {
  invariant(
    authority.address !== DEFAULT_ADDRESS,
    "Either supply an authority or set the default funder",
  );
  const instructions: IInstruction[] = [];

  const positionAddress = await getPositionAddress(positionMint);
  const position = await fetchPosition(rpc, positionAddress[0]);
  const whirlpool = await fetchWhirlpool(rpc, position.data.whirlpool);
  const quote = getDecreaseLiquidityQuote(
    param,
    whirlpool.data,
    position.data,
    slippageTolerance,
  );

  const lowerTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickLowerIndex,
    whirlpool.data.tickSpacing,
  );
  const upperTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickUpperIndex,
    whirlpool.data.tickSpacing,
  );

  const [positionTokenAccount, lowerTickArrayAddress, upperTickArrayAddress] =
    await Promise.all([
      findAssociatedTokenPda({
        owner: authority.address,
        mint: positionMint,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }).then((x) => x[0]),
      getTickArrayAddress(whirlpool.address, lowerTickArrayStartIndex).then(
        (x) => x[0],
      ),
      getTickArrayAddress(whirlpool.address, upperTickArrayStartIndex).then(
        (x) => x[0],
      ),
    ]);

  const [lowerTickArray, upperTickArray] = await fetchAllTickArray(rpc, [
    lowerTickArrayAddress,
    upperTickArrayAddress,
  ]);

  const feesQuote = collectFeesQuote(
    whirlpool.data,
    position.data,
    lowerTickArray.data,
    upperTickArray.data,
  );
  const currentUnixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const rewardsQuote = collectRewardsQuote(
    whirlpool.data,
    position.data,
    lowerTickArray.data,
    upperTickArray.data,
    currentUnixTimestamp,
  );

  const { createInstructions, cleanupInstructions, tokenAccountAddresses } =
    await prepareTokenAccountsInstructions(rpc, authority, [
      whirlpool.data.tokenMintA,
      whirlpool.data.tokenMintB,
      whirlpool.data.rewardInfos[0].mint,
      whirlpool.data.rewardInfos[1].mint,
      whirlpool.data.rewardInfos[2].mint,
    ]);

  instructions.push(...createInstructions);

  instructions.push(
    getCollectFeesInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA: tokenAccountAddresses[whirlpool.data.tokenMintA],
      tokenOwnerAccountB: tokenAccountAddresses[whirlpool.data.tokenMintB],
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
    }),
  );

  if (rewardsQuote.rewardOwed1 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[0].mint],
        rewardVault: whirlpool.data.rewardInfos[0].vault,
        rewardIndex: 0,
      }),
    );
  }

  if (rewardsQuote.rewardOwed2 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[1].mint],
        rewardVault: whirlpool.data.rewardInfos[1].vault,
        rewardIndex: 1,
      }),
    );
  }

  if (rewardsQuote.rewardOwed3 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[2].mint],
        rewardVault: whirlpool.data.rewardInfos[2].vault,
        rewardIndex: 2,
      }),
    );
  }

  instructions.push(
    getDecreaseLiquidityInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA: tokenAccountAddresses[whirlpool.data.tokenMintA],
      tokenOwnerAccountB: tokenAccountAddresses[whirlpool.data.tokenMintB],
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
      tickArrayLower: lowerTickArrayAddress,
      tickArrayUpper: upperTickArrayAddress,
      liquidityAmount: quote.liquidityDelta,
      tokenMinA: quote.tokenMinA,
      tokenMinB: quote.tokenMinB,
    }),
  );

  instructions.push(
    getClosePositionInstruction({
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      positionMint,
      receiver: authority.address,
    }),
  );

  instructions.push(...cleanupInstructions);

  return {
    instructions,
    quote,
    feesQuote,
    rewardsQuote,
  };
}
