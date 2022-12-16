import { Percentage } from "@orca-so/common-sdk";
import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import * as assert from "assert";
import {
  buildWhirlpoolClient,
  PDAUtil,
  swapQuoteByInputToken,
  toTx,
  WhirlpoolContext,
  WhirlpoolIx,
} from "../../src";
import { getTokenBalance, TickSpacing } from "../utils";
import {
  buildTestAquariums,
  FundedPositionParams,
  fundPositions,
  getDefaultAquarium,
  initTickArrayRange,
} from "../utils/init-utils";

describe("multi-swap", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Whirlpool;
  const ctx = WhirlpoolContext.fromWorkspace(provider, program);
  const fetcher = ctx.fetcher;
  const client = buildWhirlpoolClient(ctx);

  it.only("swaps [2] with multi_swap", async () => {
    const aqConfig = getDefaultAquarium();
    // Add a third token and account and a second pool
    aqConfig.initMintParams.push({});
    aqConfig.initTokenAccParams.push({ mintIndex: 2 });
    aqConfig.initPoolParams.push({ mintIndices: [1, 2], tickSpacing: TickSpacing.Standard });
    const aquarium = (await buildTestAquariums(ctx, [aqConfig]))[0];

    const { tokenAccounts, mintKeys, pools } = aquarium;
    const aToB = false;

    let tokenBalances = await Promise.all(tokenAccounts.map(({ account }) => getTokenBalance(provider, account)));
    await initTickArrayRange(
      ctx,
      pools[0].whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      aToB,
    );

    const tickArrays2 = await initTickArrayRange(
      ctx,
      pools[1].whirlpoolPda.publicKey,
      22528,
      3,
      TickSpacing.Standard,
      aToB,
    );
    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new anchor.BN(10_000_000),
        tickLowerIndex: 29440,
        tickUpperIndex: 33536,
      },
    ];

    // B + C are the same accounts here
    const tokenAccountA = tokenAccounts.find(acc => acc.mint === pools[0].tokenMintA)!.account;
    const tokenAccountB = tokenAccounts.find(acc => acc.mint === pools[0].tokenMintB)!.account;
    const tokenAccountC = tokenAccounts.find(acc => acc.mint === pools[1].tokenMintA)!.account;
    const tokenAccountD = tokenAccounts.find(acc => acc.mint === pools[1].tokenMintB)!.account;
    await fundPositions(ctx, pools[0], tokenAccountA, tokenAccountB, fundParams);
    await fundPositions(ctx, pools[1], tokenAccountC, tokenAccountD, fundParams);

    tokenBalances = await Promise.all(tokenAccounts.map(({ account }) => getTokenBalance(provider, account)));

    const tokenVaultABefore = new anchor.BN(
      await getTokenBalance(provider, pools[0].tokenVaultAKeypair.publicKey)
    );
    const tokenVaultBBefore = new anchor.BN(
      await getTokenBalance(provider, pools[0].tokenVaultBKeypair.publicKey)
    );
    const tokenVaultCBefore = new anchor.BN(
      await getTokenBalance(provider, pools[1].tokenVaultAKeypair.publicKey)
    );
    const tokenVaultDBefore = new anchor.BN(
      await getTokenBalance(provider, pools[1].tokenVaultBKeypair.publicKey)
    );

    const whirlpoolOneKey = pools[0].whirlpoolPda.publicKey;
    const whirlpoolTwoKey = pools[1].whirlpoolPda.publicKey;
    const whirlpoolOne = await client.getPool(whirlpoolOneKey, true);
    const whirlpoolTwo = await client.getPool(whirlpoolTwoKey, true);

    const [inputToken, intermediaryToken, _outputToken] = mintKeys;

    const quote = await swapQuoteByInputToken(
      whirlpoolOne,
      inputToken,
      new u64(1000),
      Percentage.fromFraction(1, 100),
      ctx.program.programId,
      fetcher,
      true
    );

    const quote2 = await swapQuoteByInputToken(
      whirlpoolTwo,
      intermediaryToken,
      quote.estimatedAmountOut,
      Percentage.fromFraction(1, 100),
      ctx.program.programId,
      fetcher,
      true
    );

    assert.ok(quote.estimatedAmountIn.gt(new anchor.BN(0)));
    assert.ok(quote.estimatedAmountOut.gt(new anchor.BN(0)));
    assert.ok(quote2.estimatedAmountIn.gt(new anchor.BN(0)));
    assert.ok(quote2.estimatedAmountOut.gt(new anchor.BN(0)));

    const oraclePda = PDAUtil.getOracle(ctx.program.programId, pools[0].whirlpoolPda.publicKey);

    await toTx(
      ctx,
      WhirlpoolIx.multiSwapIx(ctx.program, {
        // TODO: fix quotes
        ...quote,
        amount: new u64(1000),
        otherAmountThreshold: quote2.otherAmountThreshold,
        aToBOne: (quote as any).aToB,
        aToBTwo: (quote2 as any).aToB,
        sqrtPriceLimitOne: (quote as any).sqrtPriceLimit,
        sqrtPriceLimitTwo: (quote2 as any).sqrtPriceLimit,
        whirlpoolOne: pools[0].whirlpoolPda.publicKey,
        whirlpoolTwo: pools[1].whirlpoolPda.publicKey,
        tokenAuthority: ctx.wallet.publicKey,
        tokenOwnerAccountA: tokenAccountA,
        tokenVaultA: pools[0].tokenVaultAKeypair.publicKey,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultB: pools[0].tokenVaultBKeypair.publicKey,
        tokenOwnerAccountC: tokenAccountC,
        tokenVaultC: pools[1].tokenVaultAKeypair.publicKey,
        tokenOwnerAccountD: tokenAccountD,
        tokenVaultD: pools[1].tokenVaultBKeypair.publicKey,
        tickArray3: tickArrays2[0].publicKey,
        tickArray4: tickArrays2[0].publicKey,
        tickArray5: tickArrays2[0].publicKey,
        oracle: oraclePda.publicKey,
      })
    ).buildAndExecute();

    const post = await getTokenBalance(provider, pools[0].tokenVaultAKeypair.publicKey);
    assert.equal(
      await getTokenBalance(provider, pools[0].tokenVaultAKeypair.publicKey),
      tokenVaultABefore.add(quote.estimatedAmountIn).toString()
    );
    assert.equal(
      await getTokenBalance(provider, pools[0].tokenVaultBKeypair.publicKey),
      tokenVaultBBefore.sub(quote.estimatedAmountOut).toString()
    );
    assert.equal(
      await getTokenBalance(provider, pools[1].tokenVaultAKeypair.publicKey),
      tokenVaultCBefore.add(quote2.estimatedAmountIn).toString()
    );
    assert.equal(
      await getTokenBalance(provider, pools[1].tokenVaultBKeypair.publicKey),
      tokenVaultDBefore.sub(quote2.estimatedAmountOut).toString()
    );

    const prevTbs = [...tokenBalances];
    tokenBalances = await Promise.all(tokenAccounts.map(({ account }) => getTokenBalance(provider, account)));

    assert.equal(
      tokenBalances[0],
      (new anchor.BN(prevTbs[0])).sub(quote.estimatedAmountIn).toString()
    );
    assert.equal(
      tokenBalances[1],
      prevTbs[1],
    );
    assert.equal(
      tokenBalances[2],
      (new anchor.BN(prevTbs[2])).add(quote2.estimatedAmountOut).toString()
    );
  });
});

