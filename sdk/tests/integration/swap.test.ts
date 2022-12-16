import { MathUtil, Percentage } from "@orca-so/common-sdk";
import * as anchor from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { u64 } from "@solana/spl-token";
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import * as assert from "assert";
import Decimal from "decimal.js";
import {
  buildWhirlpoolClient,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  PDAUtil,
  PriceMath,
  SwapParams,
  swapQuoteByInputToken,
  TickArrayData,
  toTx,
  WhirlpoolContext,
  WhirlpoolIx,
} from "../../src";
import { getTokenBalance, MAX_U64, TickSpacing, ZERO_BN } from "../utils";
import {
  FundedPositionParams,
  fundPositions,
  initLookupTable,
  initTestPool,
  initTestPoolWithLiquidity,
  initTestPoolWithTokens,
  initTickArrayRange,
  withdrawPositions,
} from "../utils/init-utils";

describe("swap", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Whirlpool;
  const ctx = WhirlpoolContext.fromWorkspace(provider, program);
  const fetcher = ctx.fetcher;
  const client = buildWhirlpoolClient(ctx);

  it("fail on token vault mint a does not match whirlpool token a", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const { poolInitInfo: anotherPoolInitInfo } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable
    );

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: anotherPoolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7dc/ // ConstraintAddress
    );
  });

  it("fail on token vault mint b does not match whirlpool token b", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const { poolInitInfo: anotherPoolInitInfo } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable
    );

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: anotherPoolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7dc/ // ConstraintAddress
    );
  });

  it("fail on token owner account a does not match vault a mint", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountB } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Standard
    );

    const { tokenAccountA: anotherTokenAccountA } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable
    );

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: anotherTokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7d3/ // ConstraintRaw
    );
  });

  it("fail on token owner account b does not match vault b mint", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Standard
    );

    const { tokenAccountB: anotherTokenAccountB } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable
    );

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: anotherTokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7d3/ // ConstraintRaw
    );
  });

  it("fails to swap with incorrect token authority", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const otherTokenAuthority = web3.Keypair.generate();

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: otherTokenAuthority.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      )
        .addSigner(otherTokenAuthority)
        .buildAndExecute(),
      /0x4/ // OwnerMismatch
    );
  });

  it("fails on passing in the wrong tick-array", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(
        ctx,
        TickSpacing.Standard,
        MathUtil.toX64(new Decimal(0.0242).sqrt())
      ); // Negative Tick

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(-50000),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x1787/ // InvalidTickArraySequence
    );
  });

  it("fails on passing in the wrong whirlpool", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const { poolInitInfo: anotherPoolInitInfo } = await initTestPool(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: anotherPoolInitInfo.whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7d3/ // ConstraintRaw
    );
  });

  it("fails on passing in the tick-arrays from another whirlpool", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const { poolInitInfo: anotherPoolInitInfo } = await initTestPool(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      anotherPoolInitInfo.whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: anotherPoolInitInfo.whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7d3/ // ConstraintRaw
    );
  });

  it("fails on passing in an account of another type for the oracle", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: poolInitInfo.whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: tickArrays[0].publicKey,
        })
      ).buildAndExecute(),
      /0x7d6/ // ConstraintSeeds
    );
  });

  it("fails on passing in an incorrectly hashed oracle PDA", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const { poolInitInfo: anotherPoolInitInfo } = await initTestPool(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      false
    );

    const anotherOraclePda = PDAUtil.getOracle(
      ctx.program.programId,
      anotherPoolInitInfo.whirlpoolPda.publicKey
    );

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(10),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: poolInitInfo.whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: anotherOraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x7d6/ // ConstraintSeeds
    );
  });

  it("fail on passing in zero tradable amount", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      33792,
      3,
      TickSpacing.Standard,
      false
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    await assert.rejects(
      toTx(
        ctx,
        WhirlpoolIx.swapIx(ctx.program, {
          amount: new u64(0),
          otherAmountThreshold: ZERO_BN,
          sqrtPriceLimit: MathUtil.toX64(new Decimal(4.95)),
          amountSpecifiedIsInput: true,
          aToB: true,
          whirlpool: whirlpoolPda.publicKey,
          tokenAuthority: ctx.wallet.publicKey,
          tokenOwnerAccountA: tokenAccountA,
          tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
          tokenOwnerAccountB: tokenAccountB,
          tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
          tickArray0: tickArrays[0].publicKey,
          tickArray1: tickArrays[0].publicKey,
          tickArray2: tickArrays[0].publicKey,
          oracle: oraclePda.publicKey,
        })
      ).buildAndExecute(),
      /0x1793/ // ZeroTradableAmount
    );
  });

  it("swaps across one tick array", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);
    const aToB = false;
    await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528, // to 33792
      3,
      TickSpacing.Standard,
      aToB
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(10_000_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    const tokenVaultABefore = new anchor.BN(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey)
    );
    const tokenVaultBBefore = new anchor.BN(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey)
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const whirlpoolKey = poolInitInfo.whirlpoolPda.publicKey;
    const whirlpool = await client.getPool(whirlpoolKey, true);
    const whirlpoolData = whirlpool.getData();
    const quote = await swapQuoteByInputToken(
      whirlpool,
      whirlpoolData.tokenMintB,
      new u64(100000),
      Percentage.fromFraction(1, 100),
      ctx.program.programId,
      fetcher,
      true
    );

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        ...quote,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey),
      tokenVaultABefore.sub(quote.estimatedAmountOut).toString()
    );
    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey),
      tokenVaultBBefore.add(quote.estimatedAmountIn).toString()
    );
  });

  it("swaps across three tick arrays", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(
        ctx,
        TickSpacing.Stable,
        PriceMath.tickIndexToSqrtPriceX64(27500)
      );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 28160, 28864
      5,
      TickSpacing.Stable,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 27456,
        tickUpperIndex: 27840,
      },
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 28864,
        tickUpperIndex: 28928,
      },
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 27712,
        tickUpperIndex: 28928,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey),
      "1977429"
    );
    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey),
      "869058"
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    // Tick
    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(7051000),
        otherAmountThreshold: ZERO_BN,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(28500),
        amountSpecifiedIsInput: true,
        aToB: aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey),
      "1535201"
    );
    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey),
      "7920058"
    );

    // TODO: Verify fees and other whirlpool params
  });

  it("Error on passing in uninitialized tick-array", async () => {
    const { poolInitInfo, tokenAccountA, tokenAccountB, tickArrays } =
      await initTestPoolWithLiquidity(ctx);
    const whirlpool = poolInitInfo.whirlpoolPda.publicKey;

    const uninitializedTickArrayPda = PDAUtil.getTickArray(ctx.program.programId, whirlpool, 0);

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, poolInitInfo.whirlpoolPda.publicKey);

    const params: SwapParams = {
      amount: new u64(10),
      otherAmountThreshold: ZERO_BN,
      sqrtPriceLimit: MathUtil.toX64(new Decimal(4294886578)),
      amountSpecifiedIsInput: true,
      aToB: true,
      whirlpoolOne: whirlpool,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: uninitializedTickArrayPda.publicKey,
      tickArray2: tickArrays[2].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if a tick-array is uninitialized");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0xbbf/); // AccountOwnedByWrongProgram
    }
  });

  it("swaps across three tick arrays using ALTs", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(
        ctx,
        TickSpacing.Stable,
        PriceMath.tickIndexToSqrtPriceX64(27500)
      );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 28160, 28864
      5,
      TickSpacing.Stable,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 27456,
        tickUpperIndex: 27840,
      },
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 28864,
        tickUpperIndex: 28928,
      },
      {
        liquidityAmount: new anchor.BN(100_000_000),
        tickLowerIndex: 27712,
        tickUpperIndex: 28928,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey),
      "1977429"
    );
    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey),
      "869058"
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);


    const { lookupTable } = await initLookupTable(ctx, [
      whirlpoolPda.publicKey,
      ctx.wallet.publicKey,
      tokenAccountA,
      poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenAccountB,
      poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArrays[0].publicKey,
      tickArrays[1].publicKey,
      tickArrays[2].publicKey,
    ])

    const btx = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(7051000),
        otherAmountThreshold: ZERO_BN,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(28500),
        amountSpecifiedIsInput: true,
        aToB: aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: btx.transaction.instructions,
    }).compileToV0Message([lookupTable!]);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([...btx.signers, (ctx.provider.wallet as NodeWallet).payer]);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey),
      "1535201"
    );
    assert.equal(
      await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey),
      "7920058"
    );

    // TODO: Verify fees and other whirlpool params
  });

  it("Error if sqrt_price_limit exceeds max", async () => {
    const { poolInitInfo, tokenAccountA, tokenAccountB, tickArrays } =
      await initTestPoolWithLiquidity(ctx);
    const whirlpool = poolInitInfo.whirlpoolPda.publicKey;

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, poolInitInfo.whirlpoolPda.publicKey);

    const params: SwapParams = {
      amount: new u64(10),
      otherAmountThreshold: ZERO_BN,
      sqrtPriceLimit: new anchor.BN(MAX_SQRT_PRICE).add(new anchor.BN(1)),
      amountSpecifiedIsInput: true,
      aToB: true,
      whirlpoolOne: whirlpool,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[1].publicKey,
      tickArray2: tickArrays[2].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if sqrt_price exceeds maximum");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x177b/); // SqrtPriceOutOfBounds
    }
  });

  it("Error if sqrt_price_limit subceed min", async () => {
    const { poolInitInfo, tokenAccountA, tokenAccountB, tickArrays } =
      await initTestPoolWithLiquidity(ctx);
    const whirlpool = poolInitInfo.whirlpoolPda.publicKey;

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, poolInitInfo.whirlpoolPda.publicKey);

    const params: SwapParams = {
      amount: new u64(10),
      otherAmountThreshold: ZERO_BN,
      sqrtPriceLimit: new anchor.BN(MIN_SQRT_PRICE).sub(new anchor.BN(1)),
      amountSpecifiedIsInput: true,
      aToB: true,
      whirlpoolOne: whirlpool,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[1].publicKey,
      tickArray2: tickArrays[2].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if sqrt_price subceeds minimum");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x177b/); // SqrtPriceOutOfBounds
    }
  });

  it("Error if a to b swap below minimum output", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528, // to 33792
      3,
      TickSpacing.Standard,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const params = {
      amount: new u64(10),
      otherAmountThreshold: MAX_U64,
      sqrtPriceLimit: new anchor.BN(MIN_SQRT_PRICE),
      amountSpecifiedIsInput: true,
      aToB: true,
      whirlpool: whirlpoolPda.publicKey,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[0].publicKey,
      tickArray2: tickArrays[0].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if amount out is below threshold");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x1794/); // AmountOutBelowMinimum
    }
  });

  it("Error if b to a swap below minimum output", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528, // to 33792
      3,
      TickSpacing.Standard,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const params = {
      amount: new u64(10),
      otherAmountThreshold: MAX_U64,
      sqrtPriceLimit: new anchor.BN(MAX_SQRT_PRICE),
      amountSpecifiedIsInput: true,
      aToB: false,
      whirlpool: whirlpoolPda.publicKey,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[0].publicKey,
      tickArray2: tickArrays[0].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if amount out is below threshold");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x1794/); // AmountOutBelowMinimum
    }
  });

  it("Error if a to b swap above maximum input", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528, // to 33792
      3,
      TickSpacing.Standard,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const params = {
      amount: new u64(10),
      otherAmountThreshold: ZERO_BN,
      sqrtPriceLimit: new anchor.BN(MIN_SQRT_PRICE),
      amountSpecifiedIsInput: false,
      aToB: true,
      whirlpool: whirlpoolPda.publicKey,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[0].publicKey,
      tickArray2: tickArrays[0].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if amount out is below threshold");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x1795/); // AmountInAboveMaximum
    }
  });

  it("Error if b to a swap below maximum input", async () => {
    const { poolInitInfo, whirlpoolPda, tokenAccountA, tokenAccountB } =
      await initTestPoolWithTokens(ctx, TickSpacing.Standard);

    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      22528, // to 33792
      3,
      TickSpacing.Standard,
      false
    );

    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(100_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    await fundPositions(ctx, poolInitInfo, tokenAccountA, tokenAccountB, fundParams);

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const params = {
      amount: new u64(10),
      otherAmountThreshold: ZERO_BN,
      sqrtPriceLimit: new anchor.BN(MAX_SQRT_PRICE),
      amountSpecifiedIsInput: false,
      aToB: false,
      whirlpool: whirlpoolPda.publicKey,
      tokenAuthority: ctx.wallet.publicKey,
      tokenOwnerAccountA: tokenAccountA,
      tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
      tokenOwnerAccountB: tokenAccountB,
      tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
      tickArray0: tickArrays[0].publicKey,
      tickArray1: tickArrays[0].publicKey,
      tickArray2: tickArrays[0].publicKey,
      oracle: oraclePda.publicKey,
    };

    try {
      await toTx(ctx, WhirlpoolIx.swapIx(ctx.program, params)).buildAndExecute();
      assert.fail("should fail if amount out is below threshold");
    } catch (e) {
      const error = e as Error;
      assert.match(error.message, /0x1795/); // AmountInAboveMaximum
    }
  });

  // tick array range: 27658 to 29386
  // tick arrays: (27456, 28152), (28160, 28856), (28864, 29,560)
  // current tick: 27727
  // initialized ticks:
  //   27712, 27736, 27840, 28288, 28296, 28304, 28416, 28576, 28736, 29112, 29120, 29240, 29360
  const FUND_PARAMS = [
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 27712,
      tickUpperIndex: 29360,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 27736,
      tickUpperIndex: 29240,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 27840,
      tickUpperIndex: 29120,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 28288,
      tickUpperIndex: 29112,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 28416,
      tickUpperIndex: 29112,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 28288,
      tickUpperIndex: 28304,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 28296,
      tickUpperIndex: 29112,
    },
    {
      liquidityAmount: new anchor.BN(10_000_000),
      tickLowerIndex: 28576,
      tickUpperIndex: 28736,
    },
  ];

  async function initSwap(ctx: WhirlpoolContext, numTxs: number) {
    const {
      poolInitInfo,
      configInitInfo,
      configKeypairs,
      whirlpoolPda,
      tokenAccountA,
      tokenAccountB,
    } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 30528
      3,
      TickSpacing.Stable,
      aToB,
    );

    const positionInfos = await fundPositions(
      ctx,
      poolInitInfo,
      tokenAccountA,
      tokenAccountB,
      FUND_PARAMS,
    );
    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    const txs = await Promise.all(Array.from(Array(numTxs).keys()).map((_, index) => {
      if (index % 2 == 0) {
        return toTx(
          ctx,
          WhirlpoolIx.swapIx(ctx.program, {
            amount: new u64(829996),
            otherAmountThreshold: MAX_U64,
            sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
            amountSpecifiedIsInput: false,
            aToB,
            whirlpool: whirlpoolPda.publicKey,
            tokenAuthority: ctx.wallet.publicKey,
            tokenOwnerAccountA: tokenAccountA,
            tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
            tokenOwnerAccountB: tokenAccountB,
            tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
            tickArray0: tickArrays[0].publicKey,
            tickArray1: tickArrays[1].publicKey,
            tickArray2: tickArrays[2].publicKey,
            oracle: oraclePda.publicKey,
          })
        ).build();
      } else {
        return toTx(
          ctx,
          WhirlpoolIx.swapIx(ctx.program, {
            amount: new u64(14538074),
            otherAmountThreshold: MAX_U64,
            sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
            amountSpecifiedIsInput: false,
            aToB: true,
            whirlpool: whirlpoolPda.publicKey,
            tokenAuthority: ctx.wallet.publicKey,
            tokenOwnerAccountA: tokenAccountA,
            tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
            tokenOwnerAccountB: tokenAccountB,
            tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
            tickArray0: tickArrays[2].publicKey,
            tickArray1: tickArrays[1].publicKey,
            tickArray2: tickArrays[0].publicKey,
            oracle: oraclePda.publicKey,
          })
        ).build();
      }
    }));

    return {
      poolInitInfo,
      configInitInfo,
      configKeypairs,
      whirlpoolPda,
      tokenAccountA,
      tokenAccountB, 
      tickArrays,
      positionInfos,
      oraclePda,
      txs,
    };
  }

  async function initMultiSwap(ctx: WhirlpoolContext, ixs: number[]) {
    let swaps = [];
    for (const numIxs of ixs) {
      swaps.push(await initSwap(ctx, numIxs));
    }

    const altAddresses = [];
    const instructions = [];
    const signers = [];
    for (const swap of swaps) {
      altAddresses.push(swap.tickArrays.map(arr => arr.publicKey));
      altAddresses.push([
        swap.whirlpoolPda.publicKey,
        swap.poolInitInfo.tokenVaultAKeypair.publicKey,
        swap.poolInitInfo.tokenVaultBKeypair.publicKey, 
        swap.oraclePda.publicKey,
      ]);

      for (const tx of swap.txs) {
        instructions.push(...tx.transaction.instructions);
        signers.push(...tx.signers);
      }
    }

    return {
      swaps,
      altAddresses,
      instructions,
      signers,
    }
  }

  it("swaps across ten tick arrays", async () => {
    const {
      poolInitInfo,
      configInitInfo,
      configKeypairs,
      whirlpoolPda,
      tokenAccountA,
      tokenAccountB,
    } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 30528
      3,
      TickSpacing.Stable,
      aToB
    );

    // tick array range: 27658 to 29386
    // tick arrays: (27456, 28152), (28160, 28856), (28864, 29,560)
    // current tick: 27727
    // initialized ticks:
    //   27712, 27736, 27840, 28288, 28296, 28304, 28416, 28576, 28736, 29112, 29120, 29240, 29360

    const positionInfos = await fundPositions(
      ctx,
      poolInitInfo,
      tokenAccountA,
      tokenAccountB,
      FUND_PARAMS,
    );

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    // Tick
    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await withdrawPositions(ctx, positionInfos, tokenAccountA, tokenAccountB);

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));

    (
      await Promise.all(tickArrays.map((tickArray) => fetcher.getTickArray(tickArray.publicKey)))
    ).map((tickArray) => {
      const ta = tickArray as TickArrayData;
      ta.ticks.forEach((tick, index) => {
        if (!tick.initialized) {
          return;
        }

        console.log(
          ta.startTickIndex + index * TickSpacing.Stable,
          tick.feeGrowthOutsideA.toString(),
          tick.feeGrowthOutsideB.toString()
        );
      });
    });

    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: poolInitInfo.whirlpoolsConfig,
        whirlpool: poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenOwnerAccountB: tokenAccountB,
      })
    )
      .addSigner(configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));
  });

  it("swaps across ten tick arrays in single transaction", async () => {
    const {
      poolInitInfo,
      configInitInfo,
      configKeypairs,
      whirlpoolPda,
      tokenAccountA,
      tokenAccountB,
    } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 30528
      3,
      TickSpacing.Stable,
      aToB
    );

    const positionInfos = await fundPositions(
      ctx,
      poolInitInfo,
      tokenAccountA,
      tokenAccountB,
      FUND_PARAMS,
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    // Tick
    const btx1 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();
    const btx2 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx3 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx4 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx5 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx6 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [
        ...btx1.transaction.instructions,
        ...btx2.transaction.instructions,
        ...btx3.transaction.instructions,
        ...btx4.transaction.instructions,
        ...btx5.transaction.instructions,
        ...btx6.transaction.instructions,
        ...btx5.transaction.instructions,
        ...btx6.transaction.instructions,
      ],
    }).compileToV0Message([]);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...btx1.signers,
      ...btx2.signers,
      ...btx3.signers,
      ...btx4.signers,
      ...btx5.signers,
      ...btx6.signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    await withdrawPositions(ctx, positionInfos, tokenAccountA, tokenAccountB);
    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: poolInitInfo.whirlpoolsConfig,
        whirlpool: poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenOwnerAccountB: tokenAccountB,
      })
    )
      .addSigner(configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));
  });

  it("swaps across ten dual tick arrays in single transaction", async () => {
    const pool0 = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const pool1 = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const pool2 = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const aToB = false;
    const [tickArrays0, tickArrays1, tickArrays2] = await Promise.all([pool0, pool1, pool2].map(pool => initTickArrayRange(
      ctx,
      pool.whirlpoolPda.publicKey,
      27456, // to 30528
      3,
      TickSpacing.Stable,
      aToB
    )));

    // tick array range: 27658 to 29386
    // tick arrays: (27456, 28152), (28160, 28856), (28864, 29,560)
    // current tick: 27727
    // initialized ticks:
    //   27712, 27736, 27840, 28288, 28296, 28304, 28416, 28576, 28736, 29112, 29120, 29240, 29360

    const [positionInfos0, positionInfos1, positionInfos2] = await Promise.all([pool0, pool1, pool2].map(pool => fundPositions(
      ctx,
      pool.poolInitInfo,
      pool.tokenAccountA,
      pool.tokenAccountB,
      FUND_PARAMS,
    )));

    const [oraclePda0, oraclePda1, oraclePda2] = await Promise.all([pool0, pool1, pool2].map(pool => PDAUtil.getOracle(ctx.program.programId, pool.whirlpoolPda.publicKey)));

    // Tick
    const btx1 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: pool0.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool0.tokenAccountA,
        tokenVaultA: pool0.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool0.tokenAccountB,
        tokenVaultB: pool0.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays0[0].publicKey,
        tickArray1: tickArrays0[1].publicKey,
        tickArray2: tickArrays0[2].publicKey,
        oracle: oraclePda0.publicKey,
      })
    ).build();
    const btx2 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: pool0.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool0.tokenAccountA,
        tokenVaultA: pool0.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool0.tokenAccountB,
        tokenVaultB: pool0.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays0[2].publicKey,
        tickArray1: tickArrays0[1].publicKey,
        tickArray2: tickArrays0[0].publicKey,
        oracle: oraclePda0.publicKey,
      })
    ).build();
    const btx3 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: pool0.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool0.tokenAccountA,
        tokenVaultA: pool0.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool0.tokenAccountB,
        tokenVaultB: pool0.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays0[0].publicKey,
        tickArray1: tickArrays0[1].publicKey,
        tickArray2: tickArrays0[2].publicKey,
        oracle: oraclePda0.publicKey,
      })
    ).build();


    const btx4 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: pool1.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool1.tokenAccountA,
        tokenVaultA: pool1.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool1.tokenAccountB,
        tokenVaultB: pool1.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays1[0].publicKey,
        tickArray1: tickArrays1[1].publicKey,
        tickArray2: tickArrays1[2].publicKey,
        oracle: oraclePda1.publicKey,
      })
    ).build();
    const btx5 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: pool1.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool1.tokenAccountA,
        tokenVaultA: pool1.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool1.tokenAccountB,
        tokenVaultB: pool1.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays1[2].publicKey,
        tickArray1: tickArrays1[1].publicKey,
        tickArray2: tickArrays1[0].publicKey,
        oracle: oraclePda1.publicKey,
      })
    ).build();
    const btx6 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: pool1.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool1.tokenAccountA,
        tokenVaultA: pool1.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool1.tokenAccountB,
        tokenVaultB: pool1.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays1[0].publicKey,
        tickArray1: tickArrays1[1].publicKey,
        tickArray2: tickArrays1[2].publicKey,
        oracle: oraclePda1.publicKey,
      })
    ).build();


    const btx7 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: pool2.whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: pool2.tokenAccountA,
        tokenVaultA: pool2.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: pool2.tokenAccountB,
        tokenVaultB: pool2.poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays2[0].publicKey,
        tickArray1: tickArrays2[1].publicKey,
        tickArray2: tickArrays2[2].publicKey,
        oracle: oraclePda2.publicKey,
      })
    ).build();

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [
        ...btx1.transaction.instructions,
        ...btx2.transaction.instructions,
        ...btx4.transaction.instructions,
        // ...btx5.transaction.instructions,
        ...btx7.transaction.instructions,
      ],
    }).compileToV0Message([]);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...btx1.signers,
      ...btx2.signers,
      ...btx4.signers,
      // ...btx5.signers,
      ...btx7.signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    console.log("SS", swapTx, swapTx.serialize(), swapTx.serialize().length);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    await withdrawPositions(ctx, positionInfos0, pool0.tokenAccountA, pool0.tokenAccountB);
    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: pool0.poolInitInfo.whirlpoolsConfig,
        whirlpool: pool0.poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: pool0.configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: pool0.poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: pool0.poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: pool0.tokenAccountA,
        tokenOwnerAccountB: pool0.tokenAccountB,
      })
    )
      .addSigner(pool0.configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, pool0.poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, pool0.poolInitInfo.tokenVaultBKeypair.publicKey));
  });

  it("swaps across ten tick arrays in single transaction", async () => {
    const {
      poolInitInfo,
      configInitInfo,
      configKeypairs,
      whirlpoolPda,
      tokenAccountA,
      tokenAccountB,
    } = await initTestPoolWithTokens(
      ctx,
      TickSpacing.Stable,
      PriceMath.tickIndexToSqrtPriceX64(27500)
    );

    const aToB = false;
    const tickArrays = await initTickArrayRange(
      ctx,
      whirlpoolPda.publicKey,
      27456, // to 30528
      3,
      TickSpacing.Stable,
      aToB
    );

    const positionInfos = await fundPositions(
      ctx,
      poolInitInfo,
      tokenAccountA,
      tokenAccountB,
      FUND_PARAMS,
    );

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, whirlpoolPda.publicKey);

    // Tick
    const btx1 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();
    const btx2 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx3 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx4 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx5 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(829996),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(29240),
        amountSpecifiedIsInput: false,
        aToB,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[0].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[2].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const btx6 = await toTx(
      ctx,
      WhirlpoolIx.swapIx(ctx.program, {
        amount: new u64(14538074),
        otherAmountThreshold: MAX_U64,
        sqrtPriceLimit: PriceMath.tickIndexToSqrtPriceX64(27712),
        amountSpecifiedIsInput: false,
        aToB: true,
        whirlpool: whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tickArray0: tickArrays[2].publicKey,
        tickArray1: tickArrays[1].publicKey,
        tickArray2: tickArrays[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).build();

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [
        ...btx1.transaction.instructions,
        ...btx2.transaction.instructions,
        ...btx3.transaction.instructions,
        ...btx4.transaction.instructions,
        ...btx5.transaction.instructions,
        ...btx6.transaction.instructions,
        ...btx5.transaction.instructions,
        ...btx6.transaction.instructions,
      ],
    }).compileToV0Message([]);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...btx1.signers,
      ...btx2.signers,
      ...btx3.signers,
      ...btx4.signers,
      ...btx5.signers,
      ...btx6.signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    await withdrawPositions(ctx, positionInfos, tokenAccountA, tokenAccountB);
    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: poolInitInfo.whirlpoolsConfig,
        whirlpool: poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenOwnerAccountB: tokenAccountB,
      })
    )
      .addSigner(configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, poolInitInfo.tokenVaultBKeypair.publicKey));
  });

  it("fails to swap [2, 1, 1]", async () => {
    const {
      instructions,
      signers,
    } = await initMultiSwap(ctx, [2, 1, 1]);

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message([]);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    console.log("SS", swapTx, swapTx.serialize(), swapTx.serialize().length);
    try {
      await ctx.connection.sendTransaction(swapTx);
      assert.fail("should fail to swap");
    } catch (e) {
      assert.match((e as Error).message, /too large/);
    }
  });


  it("swaps [2, 1, 1] with ALTs", async () => {
    const {
      swaps,
      altAddresses,
      instructions,
      signers
    } = await initMultiSwap(ctx, [2, 1, 1]);

    console.log(swaps, altAddresses, instructions, signers);

    const lookupTables = [];
    for (const addressSet of altAddresses) {
      lookupTables.push((await initLookupTable(ctx, addressSet)).lookupTable);
    }

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTables);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    console.log("SS", swapTx, swapTx.serialize(), swapTx.serialize().length);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    await withdrawPositions(ctx, swaps[0].positionInfos, swaps[0].tokenAccountA, swaps[0].tokenAccountB);
    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: swaps[0].poolInitInfo.whirlpoolsConfig,
        whirlpool: swaps[0].poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: swaps[0].configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: swaps[0].poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: swaps[0].poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: swaps[0].tokenAccountA,
        tokenOwnerAccountB: swaps[0].tokenAccountB,
      })
    )
      .addSigner(swaps[0].configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, swaps[0].poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, swaps[0].poolInitInfo.tokenVaultBKeypair.publicKey));
  });

  it("swaps [1, 1, 1, 1, 1] with ALTs", async () => {
    const {
      swaps,
      altAddresses,
      instructions,
      signers
    } = await initMultiSwap(ctx, [1, 1, 1, 1, 1]);

    const lookupTables = [];
    for (const addressSet of altAddresses) {
      lookupTables.push((await initLookupTable(ctx, addressSet)).lookupTable);
    }

    const {
      value: { blockhash, lastValidBlockHeight },
    } = await ctx.connection.getLatestBlockhashAndContext("finalized");
    const payer = ctx.provider.wallet.publicKey;
    const swapV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTables);
    const swapTx = new VersionedTransaction(swapV0);
    swapTx.sign([
      ...signers,
      (ctx.provider.wallet as NodeWallet).payer,
    ]);
    const swapTxId = await ctx.connection.sendTransaction(swapTx);
    await ctx.connection.confirmTransaction({ signature: swapTxId, blockhash, lastValidBlockHeight }, "confirmed");

    await withdrawPositions(ctx, swaps[0].positionInfos, swaps[0].tokenAccountA, swaps[0].tokenAccountB);
    await toTx(
      ctx,
      WhirlpoolIx.collectProtocolFeesIx(ctx.program, {
        whirlpoolsConfig: swaps[0].poolInitInfo.whirlpoolsConfig,
        whirlpool: swaps[0].poolInitInfo.whirlpoolPda.publicKey,
        collectProtocolFeesAuthority: swaps[0].configKeypairs.collectProtocolFeesAuthorityKeypair.publicKey,
        tokenVaultA: swaps[0].poolInitInfo.tokenVaultAKeypair.publicKey,
        tokenVaultB: swaps[0].poolInitInfo.tokenVaultBKeypair.publicKey,
        tokenOwnerAccountA: swaps[0].tokenAccountA,
        tokenOwnerAccountB: swaps[0].tokenAccountB,
      })
    )
      .addSigner(swaps[0].configKeypairs.collectProtocolFeesAuthorityKeypair)
      .buildAndExecute();

    console.log(await getTokenBalance(provider, swaps[0].poolInitInfo.tokenVaultAKeypair.publicKey));
    console.log(await getTokenBalance(provider, swaps[0].poolInitInfo.tokenVaultBKeypair.publicKey));
  });
});

