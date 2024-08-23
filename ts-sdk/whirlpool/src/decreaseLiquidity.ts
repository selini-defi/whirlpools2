import type { Whirlpool } from "@orca-so/whirlpools-client";
import {
  fetchAllMaybeTickArray,
  fetchAllTickArray,
  fetchPosition,
  fetchWhirlpool,
  getClosePositionInstruction,
  getCollectFeesInstruction,
  getCollectRewardInstruction,
  getDecreaseLiquidityInstruction,
  getIncreaseLiquidityInstruction,
  getInitializeTickArrayInstruction,
  getOpenPositionInstruction,
  getPositionAddress,
  getTickArrayAddress,
  getTickArraySize,
} from "@orca-so/whirlpools-client";
import type {
  CollectFeesQuote,
  CollectRewardsQuote,
  DecreaseLiquidityQuote,
  IncreaseLiquidityQuote,
  TickRange,
} from "@orca-so/whirlpools-core";
import {
  _MAX_TICK_INDEX,
  _MIN_TICK_INDEX,
  getFullRangeTickIndexes,
  getTickArrayStartTickIndex,
  increaseLiquidityQuote,
  increaseLiquidityQuoteA,
  increaseLiquidityQuoteB,
  priceToTickIndex,
  getInitializableTickIndex,
  orderTickIndexes,
  decreaseLiquidityQuote,
  decreaseLiquidityQuoteA,
  decreaseLiquidityQuoteB,
  collectFeesQuote,
  collectRewardsQuote,
} from "@orca-so/whirlpools-core";
import type {
  Account,
  Address,
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  GetMultipleAccountsApi,
  IInstruction,
  LamportsUnsafeBeyond2Pow53Minus1,
  Rpc,
  TransactionPartialSigner,
} from "@solana/web3.js";
import { generateKeyPairSigner, lamports } from "@solana/web3.js";
import {
  DEFAULT_ADDRESS,
  DEFAULT_FUNDER,
  DEFAULT_SLIPPAGE_TOLERANCE,
} from "./config";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  fetchAllMaybeToken,
  fetchAllMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import invariant from "tiny-invariant";

type DecreaseLiquidityQuoteInput =
  | {
      liquidity: bigint;
    }
  | {
      tokenA: bigint;
    }
  | {
      tokenB: bigint;
    };

type DecreaseLiquidityQuoteParam = DecreaseLiquidityQuoteInput & {
  slippageTolerance?: number;
};

type DecreaseLiquidityInstructions = {
  quote: DecreaseLiquidityQuote;
  instructions: IInstruction[];
};

function getDecreaseLiquidityQuote(
  param: DecreaseLiquidityQuoteParam,
  pool: Whirlpool,
  tickRange: TickRange,
): DecreaseLiquidityQuote {
  const slippageTolerance =
    param.slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE;
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
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  positionMint: Address,
  param: DecreaseLiquidityQuoteParam,
  authority: TransactionPartialSigner = DEFAULT_FUNDER,
): Promise<DecreaseLiquidityInstructions> {
  invariant(
    authority.address !== DEFAULT_ADDRESS,
    "Either supply the authority or set the default funder",
  );

  const positionAddress = await getPositionAddress(positionMint);
  const position = await fetchPosition(rpc, positionAddress[0]);
  const whirlpool = await fetchWhirlpool(rpc, position.data.whirlpool);
  const quote = getDecreaseLiquidityQuote(param, whirlpool.data, position.data);
  const instructions: IInstruction[] = [];

  const lowerTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickLowerIndex,
    whirlpool.data.tickSpacing,
  );
  const upperTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickUpperIndex,
    whirlpool.data.tickSpacing,
  );

  const [
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tickArrayLower,
    tickArrayUpper,
  ] = await Promise.all([
    findAssociatedTokenPda({
      owner: authority.address,
      mint: positionMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintA,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintB,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    getTickArrayAddress(whirlpool.address, lowerTickArrayStartIndex).then(
      (x) => x[0],
    ),
    getTickArrayAddress(whirlpool.address, upperTickArrayStartIndex).then(
      (x) => x[0],
    ),
  ]);

  const [ataA, ataB] = await fetchAllMaybeToken(rpc, [tokenOwnerAccountA, tokenOwnerAccountB]);

  if (!ataA.exists) {
    instructions.push(
      getCreateAssociatedTokenInstruction({
        payer: authority,
        owner: authority.address,
        ata: tokenOwnerAccountA,
        mint: whirlpool.data.tokenMintA,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );
  }

  if (!ataB.exists) {
    instructions.push(
      getCreateAssociatedTokenInstruction({
        payer: authority,
        owner: authority.address,
        ata: tokenOwnerAccountB,
        mint: whirlpool.data.tokenMintB,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );
  }

  instructions.push(
    getDecreaseLiquidityInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: position.address,
      positionTokenAccount,
      tokenOwnerAccountA,
      tokenOwnerAccountB,
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
      tickArrayLower,
      tickArrayUpper,
      liquidityAmount: quote.liquidityDelta,
      tokenMinA: quote.tokenMinA,
      tokenMinB: quote.tokenMinB,
    }),
  );
  return { quote, instructions };
}

type ClosePositionInstructions = DecreaseLiquidityInstructions & {
  feesQuote: CollectFeesQuote;
  rewardsQuote: CollectRewardsQuote;
}

export async function closePositionInstructions(
  rpc: Rpc<
    GetAccountInfoApi &
      GetMultipleAccountsApi &
      GetMinimumBalanceForRentExemptionApi
  >,
  positionMint: Address,
  param: DecreaseLiquidityQuoteParam,
  authority: TransactionPartialSigner = DEFAULT_FUNDER,
): Promise<ClosePositionInstructions> {
  invariant(
    authority.address !== DEFAULT_ADDRESS,
    "Either supply an authority or set the default funder",
  );
  const instructions: IInstruction[] = [];
  let stateSpace = 0;

  const positionAddress = await getPositionAddress(positionMint);
  const position = await fetchPosition(rpc, positionAddress[0]);
  const whirlpool = await fetchWhirlpool(rpc, position.data.whirlpool);
  const quote = getDecreaseLiquidityQuote(param, whirlpool.data, position.data);

  const lowerTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickLowerIndex,
    whirlpool.data.tickSpacing,
  );
  const upperTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickUpperIndex,
    whirlpool.data.tickSpacing,
  );

  const [
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tokenOwnerAccountReward1,
    tokenOwnerAccountReward2,
    tokenOwnerAccountReward3,
    lowerTickArrayAddress,
    upperTickArrayAddress,
  ] = await Promise.all([
    findAssociatedTokenPda({
      owner: authority.address,
      mint: positionMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintA,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintB,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[0].mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[1].mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[2].mint,
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

  const feesQuote = collectFeesQuote(whirlpool.data, position.data, lowerTickArray.data, upperTickArray.data);
  const currentUnixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const rewardsQuote = collectRewardsQuote(whirlpool.data, position.data, lowerTickArray.data, upperTickArray.data, currentUnixTimestamp);

  const ataMap = new Map([
    [tokenOwnerAccountA, whirlpool.data.tokenMintA],
    [tokenOwnerAccountB, whirlpool.data.tokenMintB],
    [tokenOwnerAccountReward1, whirlpool.data.rewardInfos[0].mint],
    [tokenOwnerAccountReward2, whirlpool.data.rewardInfos[1].mint],
    [tokenOwnerAccountReward3, whirlpool.data.rewardInfos[2].mint],
  ]);
  const ataAccounts = await fetchAllMaybeToken(rpc, Array.from(ataMap.keys()));
  const missingAtaAccounts = ataAccounts.filter(x => !x.exists);

  for (const missingAtaAccount of missingAtaAccounts) {
    instructions.push(
      getCreateAssociatedTokenInstruction({
        payer: authority,
        owner: authority.address,
        ata: missingAtaAccount.address,
        mint: ataMap.get(missingAtaAccount.address)!,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );
  }

  instructions.push(
    getCollectFeesInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA,
      tokenOwnerAccountB,
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
    })
  );

  if (rewardsQuote.rewardOwed1 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward1,
        rewardVault: whirlpool.data.rewardInfos[0].vault,
        rewardIndex: 0,
      })
    );
  }

  if (rewardsQuote.rewardOwed2 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward2,
        rewardVault: whirlpool.data.rewardInfos[1].vault,
        rewardIndex: 1,
      })
    );
  }

  if (rewardsQuote.rewardOwed3 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward3,
        rewardVault: whirlpool.data.rewardInfos[2].vault,
        rewardIndex: 2,
      })
    );
  }

  instructions.push(
    getDecreaseLiquidityInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA,
      tokenOwnerAccountB,
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
    })
  );

  return {
    instructions,
    quote,
    feesQuote,
    rewardsQuote,
  };
}
