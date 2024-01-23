import * as anchor from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import * as assert from "assert";
import { BN } from "bn.js";
import {
  buildWhirlpoolClient, MAX_SQRT_PRICE, MAX_TICK_INDEX, MIN_SQRT_PRICE, MIN_TICK_INDEX, PriceMath,
  swapQuoteByInputToken,
  swapQuoteByOutputToken,
  swapQuoteWithParams, SwapUtils, TICK_ARRAY_SIZE,
  WhirlpoolContext
} from "../../../../src";
import { SwapErrorCode, WhirlpoolsError } from "../../../../src/errors/errors";
import { IGNORE_CACHE } from "../../../../src/network/public/fetcher";
import { assertInputOutputQuoteEqual, assertQuoteAndResults, TickSpacing } from "../../../utils";
import { defaultConfirmOptions } from "../../../utils/const";
import {
  arrayTickIndexToTickIndex,
  buildPosition,
  setupSwapTest
} from "../../../utils/swap-test-utils";
import { getVaultAmounts } from "../../../utils/whirlpools-test-utils";

describe("poc virtual tickarray", () => {
  const provider = anchor.AnchorProvider.local(undefined, defaultConfirmOptions);

  const program = anchor.workspace.Whirlpool;
  const ctx = WhirlpoolContext.fromWorkspace(provider, program);
  const fetcher = ctx.fetcher;
  const client = buildWhirlpoolClient(ctx);
  const tickSpacing = TickSpacing.SixtyFour;
  const slippageTolerance = Percentage.fromFraction(0, 100);

  /**
   * |-------a----x2------|-----------------|----x1-----a-------|
   */
  it("swap through 2nd tickarray, 2nd tickarray has no initialized tick, a->b", async () => {
    const currIndex = arrayTickIndexToTickIndex({ arrayIndex: 1, offsetIndex: 22 }, tickSpacing);
    const whirlpool = await setupSwapTest({
      ctx,
      client,
      tickSpacing,
      initSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(currIndex),
      initArrayStartTicks: [-5632, 0, 5632],
      fundedPositions: [
        buildPosition(
          // a
          { arrayIndex: -1, offsetIndex: 10 },
          { arrayIndex: 1, offsetIndex: 23 },
          tickSpacing,
          new BN(250_000_000)
        ),
      ],
    });

    const whirlpoolData = await whirlpool.refreshData();
    const inputTokenQuote = await swapQuoteByInputToken(
      whirlpool,
      whirlpoolData.tokenMintA,
      new BN(119500000),
      slippageTolerance,
      ctx.program.programId,
      fetcher,
      IGNORE_CACHE
    );

    ////////////////////////////////////////////////////////////////////////////////
    // check pre state
    ////////////////////////////////////////////////////////////////////////////////
    const preTickArray0 = await fetcher.getTickArray(inputTokenQuote.tickArray0, IGNORE_CACHE);
    const preTickArray1 = await fetcher.getTickArray(inputTokenQuote.tickArray1, IGNORE_CACHE);
    const preTickArray2 = await fetcher.getTickArray(inputTokenQuote.tickArray2, IGNORE_CACHE);
    assert.equal(preTickArray0?.startTickIndex, 5632);
    assert.equal(preTickArray1?.startTickIndex, 0);
    assert.equal(preTickArray2?.startTickIndex, -5632);

    // currentTickIndex on tickArray0
    assert.ok(whirlpoolData.tickCurrentIndex > 5632);

    // tickArray1 is ZERO state
    preTickArray1?.ticks.forEach((tick) => {
      assert.equal(tick.initialized, false);
      assert.ok(tick.liquidityNet.isZero());
      assert.ok(tick.liquidityGross.isZero());
      assert.ok(tick.feeGrowthOutsideA.isZero());
      assert.ok(tick.feeGrowthOutsideB.isZero());
      assert.ok(tick.rewardGrowthsOutside[0].isZero());
      assert.ok(tick.rewardGrowthsOutside[1].isZero());
      assert.ok(tick.rewardGrowthsOutside[2].isZero());
    });

    ////////////////////////////////////////////////////////////////////////////////
    // swap
    ////////////////////////////////////////////////////////////////////////////////
    await (await whirlpool.swap(inputTokenQuote)).buildAndExecute();
    const newData = await whirlpool.refreshData();

    ////////////////////////////////////////////////////////////////////////////////
    // check post state
    ////////////////////////////////////////////////////////////////////////////////
    const postTickArray0 = await fetcher.getTickArray(inputTokenQuote.tickArray0, IGNORE_CACHE);
    const postTickArray1 = await fetcher.getTickArray(inputTokenQuote.tickArray1, IGNORE_CACHE);
    const postTickArray2 = await fetcher.getTickArray(inputTokenQuote.tickArray2, IGNORE_CACHE);
    assert.equal(postTickArray0?.startTickIndex, 5632);
    assert.equal(postTickArray1?.startTickIndex, 0);
    assert.equal(postTickArray2?.startTickIndex, -5632);

    // currentTickIndex on tickArray2
    assert.ok(newData.tickCurrentIndex >= -5632);
    assert.ok(newData.tickCurrentIndex < 0);

    // tickArray1 is still ZERO state
    postTickArray1?.ticks.forEach((tick) => {
      assert.equal(tick.initialized, false);
      assert.ok(tick.liquidityNet.isZero());
      assert.ok(tick.liquidityGross.isZero());
      assert.ok(tick.feeGrowthOutsideA.isZero());
      assert.ok(tick.feeGrowthOutsideB.isZero());
      assert.ok(tick.rewardGrowthsOutside[0].isZero());
      assert.ok(tick.rewardGrowthsOutside[1].isZero());
      assert.ok(tick.rewardGrowthsOutside[2].isZero());
    });    
  });

  /**
   * |-------a------------|----x2-----------|----x1-----a-------|
   */
  it("swap stop at 2nd tickarray, 2nd tickarray has no initialized tick, a->b", async () => {
    const currIndex = arrayTickIndexToTickIndex({ arrayIndex: 1, offsetIndex: 22 }, tickSpacing);
    const whirlpool = await setupSwapTest({
      ctx,
      client,
      tickSpacing,
      initSqrtPrice: PriceMath.tickIndexToSqrtPriceX64(currIndex),
      initArrayStartTicks: [-5632, 0, 5632],
      fundedPositions: [
        buildPosition(
          // a
          { arrayIndex: -1, offsetIndex: 10 },
          { arrayIndex: 1, offsetIndex: 23 },
          tickSpacing,
          new BN(250_000_000)
        ),
      ],
    });

    const whirlpoolData = await whirlpool.refreshData();
    const inputTokenQuote = await swapQuoteByInputToken(
      whirlpool,
      whirlpoolData.tokenMintA,
      new BN(59500000),
      slippageTolerance,
      ctx.program.programId,
      fetcher,
      IGNORE_CACHE
    );

    ////////////////////////////////////////////////////////////////////////////////
    // check pre state
    ////////////////////////////////////////////////////////////////////////////////
    const preTickArray0 = await fetcher.getTickArray(inputTokenQuote.tickArray0, IGNORE_CACHE);
    const preTickArray1 = await fetcher.getTickArray(inputTokenQuote.tickArray1, IGNORE_CACHE);
    const preTickArray2 = await fetcher.getTickArray(inputTokenQuote.tickArray2, IGNORE_CACHE);
    assert.equal(preTickArray0?.startTickIndex, 5632);
    assert.equal(preTickArray1?.startTickIndex, 0);
    assert.equal(preTickArray2?.startTickIndex, -5632);

    // currentTickIndex on tickArray0
    assert.ok(whirlpoolData.tickCurrentIndex > 5632);

    // tickArray1 is ZERO state
    preTickArray1?.ticks.forEach((tick) => {
      assert.equal(tick.initialized, false);
      assert.ok(tick.liquidityNet.isZero());
      assert.ok(tick.liquidityGross.isZero());
      assert.ok(tick.feeGrowthOutsideA.isZero());
      assert.ok(tick.feeGrowthOutsideB.isZero());
      assert.ok(tick.rewardGrowthsOutside[0].isZero());
      assert.ok(tick.rewardGrowthsOutside[1].isZero());
      assert.ok(tick.rewardGrowthsOutside[2].isZero());
    });

    ////////////////////////////////////////////////////////////////////////////////
    // swap
    ////////////////////////////////////////////////////////////////////////////////
    await (await whirlpool.swap(inputTokenQuote)).buildAndExecute();
    const newData = await whirlpool.refreshData();

    ////////////////////////////////////////////////////////////////////////////////
    // check post state
    ////////////////////////////////////////////////////////////////////////////////
    const postTickArray0 = await fetcher.getTickArray(inputTokenQuote.tickArray0, IGNORE_CACHE);
    const postTickArray1 = await fetcher.getTickArray(inputTokenQuote.tickArray1, IGNORE_CACHE);
    const postTickArray2 = await fetcher.getTickArray(inputTokenQuote.tickArray2, IGNORE_CACHE);
    assert.equal(postTickArray0?.startTickIndex, 5632);
    assert.equal(postTickArray1?.startTickIndex, 0);
    assert.equal(postTickArray2?.startTickIndex, -5632);

    // currentTickIndex on tickArray1
    assert.ok(newData.tickCurrentIndex >= 0);
    assert.ok(newData.tickCurrentIndex < 5632);

    // tickArray1 is still ZERO state
    postTickArray1?.ticks.forEach((tick) => {
      assert.equal(tick.initialized, false);
      assert.ok(tick.liquidityNet.isZero());
      assert.ok(tick.liquidityGross.isZero());
      assert.ok(tick.feeGrowthOutsideA.isZero());
      assert.ok(tick.feeGrowthOutsideB.isZero());
      assert.ok(tick.rewardGrowthsOutside[0].isZero());
      assert.ok(tick.rewardGrowthsOutside[1].isZero());
      assert.ok(tick.rewardGrowthsOutside[2].isZero());
    });    
  });
  
});
