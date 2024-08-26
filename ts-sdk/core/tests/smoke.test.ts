import { describe, it } from "mocha";
import { collectFeesQuote, collectRewardsQuote, decreaseLiquidityQuote, increaseLiquidityQuote, PositionFacade, PositionRewardInfoFacade, swapQuoteByOutputToken, TickArrayFacade, TickFacade, WhirlpoolFacade, WhirlpoolRewardInfoFacade } from "../dist/nodejs/orca_whirlpools_core_js_bindings";
import assert from "assert";

// Assumption: if a complex test cases produces the same result as the rust test,
// then the WASM bundle is working correctly and we don't need to test every single
// function in the WASM bundle.

function testWhirlpool(): WhirlpoolFacade {
  return {
    tickCurrentIndex: 100,
    feeGrowthGlobalA: 800n,
    feeGrowthGlobalB: 1000n,
    feeRate: 3000,
    liquidity: 100000n,
    sqrtPrice: 1n << 64n,
    tickSpacing: 2,
    rewardLastUpdatedTimestamp: 0,
    rewardInfos: [
      {
        growthGlobalX64: 500n,
        emissionsPerSecondX64: 1n,
      },
      {
        growthGlobalX64: 600n,
        emissionsPerSecondX64: 2n,
      },
      {
        growthGlobalX64: 700n,
        emissionsPerSecondX64: 3n,
      },
    ],
  }
}

function testTick(positive: boolean = true): TickFacade {
  const liquidityNet = positive ? 1000n : -1000n;
  return {
    initialized: true,
    liquidityNet,
    feeGrowthOutsideA: 50n,
    feeGrowthOutsideB: 20n,
    rewardGrowthsOutside: [10n, 20n, 30n],
  }
}

function testTickArray(startTickIndex: number): TickArrayFacade {
  return {
    startTickIndex,
    ticks: Array.from({ length: 10 }, () => testTick(startTickIndex < 0)),
  }
}

function testPosition(): PositionFacade {
  return {
    liquidity: 50n,
            tickLowerIndex: 95,
            tickUpperIndex: 105,
            feeGrowthCheckpointA: 300n,
            feeOwedA: 400,
            feeGrowthCheckpointB: 500n,
            feeOwedB: 600,
            rewardInfos: [
              {
                growthInsideCheckpoint: 100n,
                amountOwed: 100,
              },
              {
                growthInsideCheckpoint: 200n,
                amountOwed: 200,
              },
              {
                growthInsideCheckpoint: 300n,
                amountOwed: 300,
              },
            ],
  }
}

describe("WASM bundle smoke test", () => {
  it("Swap", async () => {
    const result = swapQuoteByOutputToken(
      1000n,
      true,
      1000,
      testWhirlpool(),
      testTickArray(-176),
      testTickArray(0),
      testTickArray(176)
    );
    assert.strictEqual(result.tokenOut, 1000);
    assert.strictEqual(result.tokenEstIn, 1141);
    assert.strictEqual(result.tokenMaxIn, 1256);
    assert.strictEqual(result.totalFee, 76);
  });

  it("IncreaseLiquidity", async () => {
    const result = increaseLiquidityQuote(
      1000000n,
      100,
      0,
      -10,
      10,
      { feeBps: 2000, maxFee: 100000 },
      { feeBps: 1000, maxFee: 100000 },
    );
    assert.strictEqual(result.liquidityDelta, 1000000);
    assert.strictEqual(result.tokenEstA, 625);
    assert.strictEqual(result.tokenEstB, 556);
    assert.strictEqual(result.tokenMaxA, 632);
    assert.strictEqual(result.tokenMaxB, 562);
  });

  it("DecreaseLiquidity", async () => {
    const result = decreaseLiquidityQuote(
      1000000n,
      100,
      0,
      -10,
      10,
      { feeBps: 2000, maxFee: 100000 },
      { feeBps: 1000, maxFee: 100000 },
    );
    assert.strictEqual(result.liquidityDelta, 1000000);
    assert.strictEqual(result.tokenEstA, 400);
    assert.strictEqual(result.tokenEstB, 450);
    assert.strictEqual(result.tokenMinA, 396);
    assert.strictEqual(result.tokenMinB, 445);
  });

  it("CollectFeesQuote", async () => {
    const result = collectFeesQuote(
      testWhirlpool(),
      testPosition(),
      testTick(),
      testTick(),
      { feeBps: 2000, maxFee: 100000 },
      { feeBps: 5000, maxFee: 100000 },
    );
    assert.strictEqual(result.feeOwedA, 492);
    assert.strictEqual(result.feeOwedB, 424);
  });

  it("CollectRewardsQuote", async () => {
    const result = collectRewardsQuote(
      testWhirlpool(),
      testPosition(),
      testTick(),
      testTick(),
      10n,
      { feeBps: 1000, maxFee: 100000 },
      { feeBps: 2000, maxFee: 100000 },
      { feeBps: 3000, maxFee: 100000 },
    );
    assert.strictEqual(result.rewardOwed1, 17190);
    assert.strictEqual(result.rewardOwed2, 14560);
    assert.strictEqual(result.rewardOwed3, 12110);
  });
});
