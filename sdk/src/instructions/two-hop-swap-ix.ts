import { Instruction } from "@orca-so/common-sdk";
import { BN, Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Whirlpool } from "../artifacts/whirlpool";

/// TODO(comment after naming)
export type TwoHopSwapParams = TwoHopSwapInput & {
  whirlpoolOne: PublicKey;
  whirlpoolTwo: PublicKey;
  tokenOwnerAccountOneA: PublicKey;
  tokenOwnerAccountOneB: PublicKey;
  tokenOwnerAccountTwoA: PublicKey;
  tokenOwnerAccountTwoB: PublicKey;
  tokenVaultOneA: PublicKey;
  tokenVaultOneB: PublicKey;
  tokenVaultTwoA: PublicKey;
  tokenVaultTwoB: PublicKey;
  tokenAuthority: PublicKey;
};

/**
 * Parameters to swap on a Whirlpool
 *
 * @category Instruction Types
 * @param aToB - The direction of the swap. True if swapping from A to B. False if swapping from B to A.
 * @param amountSpecifiedIsInput - Specifies the token the parameter `amount`represents. If true, the amount represents
 *                                 the input token of the swap.
 * @param amount - The amount of input or output token to swap from (depending on amountSpecifiedIsInput).
 * @param otherAmountThreshold - The maximum/minimum of input/output token to swap into (depending on amountSpecifiedIsInput).
 * @param sqrtPriceLimit - The maximum/minimum price the swap will swap to.
 * @param tickArray0 - PublicKey of the tick-array where the Whirlpool's currentTickIndex resides in
 * @param tickArray1 - The next tick-array in the swap direction. If the swap will not reach the next tick-aray, input the same array as tickArray0.
 * @param tickArray2 - The next tick-array in the swap direction after tickArray2. If the swap will not reach the next tick-aray, input the same array as tickArray1.
 */
export type TwoHopSwapInput = {
  amount: u64;
  otherAmountThreshold: u64;
  amountSpecifiedIsInput: boolean;
  aToBOne: boolean;
  aToBTwo: boolean;
  sqrtPriceLimitOne: BN;
  sqrtPriceLimitTwo: BN;
  tickArrayOne0: PublicKey;
  tickArrayOne1: PublicKey;
  tickArrayOne2: PublicKey;
  tickArrayTwo0: PublicKey;
  tickArrayTwo1: PublicKey;
  tickArrayTwo2: PublicKey;
};

/**
 * Parameters to swap on a Whirlpool with developer fees
 *
 * @category Instruction Types
 * @param aToB - The direction of the swap. True if swapping from A to B. False if swapping from B to A.
 * @param amountSpecifiedIsInput - Specifies the token the parameter `amount`represents. If true, the amount represents
 *                                 the input token of the swap.
 * @param amount - The amount of input or output token to swap from (depending on amountSpecifiedIsInput).
 * @param otherAmountThreshold - The maximum/minimum of input/output token to swap into (depending on amountSpecifiedIsInput).
 * @param sqrtPriceLimit - The maximum/minimum price the swap will swap to.
 * @param tickArray0 - PublicKey of the tick-array where the Whirlpool's currentTickIndex resides in
 * @param tickArray1 - The next tick-array in the swap direction. If the swap will not reach the next tick-aray, input the same array as tickArray0.
 * @param tickArray2 - The next tick-array in the swap direction after tickArray2. If the swap will not reach the next tick-aray, input the same array as tickArray1.
 * @param devFeeAmount -  FeeAmount (developer fees) charged on this swap
 */
export type DevFeeTwoHopSwapInput = TwoHopSwapInput & {
  devFeeAmount: u64;
};

/**
 * Perform a swap in this Whirlpool
 *
 * #### Special Errors
 * - `ZeroTradableAmount` - User provided parameter `amount` is 0.
 * - `InvalidSqrtPriceLimitDirection` - User provided parameter `sqrt_price_limit` does not match the direction of the trade.
 * - `SqrtPriceOutOfBounds` - User provided parameter `sqrt_price_limit` is over Whirlppool's max/min bounds for sqrt-price.
 * - `InvalidTickArraySequence` - User provided tick-arrays are not in sequential order required to proceed in this trade direction.
 * - `TickArraySequenceInvalidIndex` - The swap loop attempted to access an invalid array index during the query of the next initialized tick.
 * - `TickArrayIndexOutofBounds` - The swap loop attempted to access an invalid array index during tick crossing.
 * - `LiquidityOverflow` - Liquidity value overflowed 128bits during tick crossing.
 * - `InvalidTickSpacing` - The swap pool was initialized with tick-spacing of 0.
 *
 * ### Parameters
 * @category Instructions
 * @param context - Context object containing services required to generate the instruction
 * @param params - SwapParams object
 * @returns - Instruction to perform the action.
 */
export function twoHopSwapIx(program: Program<Whirlpool>, params: TwoHopSwapParams): Instruction {
  const {
    amount,
    otherAmountThreshold,
    amountSpecifiedIsInput,
    aToBOne,
    aToBTwo,
    sqrtPriceLimitOne,
    sqrtPriceLimitTwo,
    whirlpoolOne,
    whirlpoolTwo,
    tokenAuthority,
    tokenOwnerAccountOneA,
    tokenVaultOneA,
    tokenOwnerAccountOneB,
    tokenVaultOneB,
    tokenOwnerAccountTwoA,
    tokenVaultTwoA,
    tokenOwnerAccountTwoB,
    tokenVaultTwoB,
    tickArrayOne0,
    tickArrayOne1,
    tickArrayOne2,
    tickArrayTwo0,
    tickArrayTwo1,
    tickArrayTwo2,
  } = params;

  const ix = program.instruction.twoHopSwap(
    amount,
    otherAmountThreshold,
    amountSpecifiedIsInput,
    aToBOne,
    aToBTwo,
    sqrtPriceLimitOne,
    sqrtPriceLimitTwo,
    {
      accounts: {
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenAuthority,
        whirlpoolOne,
        whirlpoolTwo,
        tokenOwnerAccountOneA,
        tokenVaultOneA,
        tokenOwnerAccountOneB,
        tokenVaultOneB,
        tokenOwnerAccountTwoA,
        tokenVaultTwoA,
        tokenOwnerAccountTwoB,
        tokenVaultTwoB,
        tickArrayOne0,
        tickArrayOne1,
        tickArrayOne2,
        tickArrayTwo0,
        tickArrayTwo1,
        tickArrayTwo2,
      },
    }
  );

  return {
    instructions: [ix],
    cleanupInstructions: [],
    signers: [],
  };
}
