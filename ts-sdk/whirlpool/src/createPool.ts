import { fetchAllMaybeFeeTier, fetchAllMaybeWhirlpool, fetchFeeTier, fetchMaybeWhirlpool, fetchWhirlpoolsConfig, getFeeTierAddress, getInitializePoolV2Instruction, getInitializeTickArrayInstruction, getTickArrayAddress, getTokenBadgeAddress, getWhirlpoolAddress, Whirlpool } from '@orca-so/whirlpools-client';
import { Address, GetAccountInfoApi, GetMultipleAccountsApi, IInstruction, Rpc, TransactionPartialSigner, generateKeyPairSigner } from '@solana/web3.js';
import { DEFAULT_ADDRESS, DEFAULT_FUNDER, SPLASH_POOL_TICK_SPACING, SUPPORTED_TICK_SPACINGS, WHIRLPOOLS_CONFIG_ADDRESS } from './config';
import invariant from 'tiny-invariant';
import { getFullRangeTickIndexes, getTickArrayStartTickIndex, priceToSqrtPrice, sqrtPriceToTickIndex } from '@orca-so/whirlpools-core';
import { fetchAllMint } from '@solana-program/token';

type InitializablePool = {
  initialized: false;
} & Pick<Whirlpool, "whirlpoolsConfig" | "tickSpacing" | "feeRate" | "protocolFeeRate" | "tokenMintA" | "tokenMintB">;

type InitializedPool = {
  initialized: true;
} & Whirlpool;

type PoolInfo = (InitializablePool | InitializedPool) & { address: Address };

export async function fetchSplashPool(rpc: Rpc<GetAccountInfoApi>, tokenMintOne: Address, tokenMintTwo: Address): Promise<PoolInfo> {
  return fetchPool(rpc, tokenMintOne, tokenMintTwo, SPLASH_POOL_TICK_SPACING);
}

export async function fetchPool(rpc: Rpc<GetAccountInfoApi>, tokenMintOne: Address, tokenMintTwo: Address, tickSpacing: number): Promise<PoolInfo> {
  const [tokenMintA, tokenMintB] = Buffer.from(tokenMintOne) < Buffer.from(tokenMintTwo) ? [tokenMintOne, tokenMintTwo] : [tokenMintTwo, tokenMintOne];
  const feeTierAddress = await getFeeTierAddress(WHIRLPOOLS_CONFIG_ADDRESS, tickSpacing).then(x => x[0]);
  const poolAddress = await getWhirlpoolAddress(WHIRLPOOLS_CONFIG_ADDRESS, tokenMintA, tokenMintB, tickSpacing).then(x => x[0]);

  // TODO: this is multiple rpc calls. Can we do it in one?
  const [configAccount, feeTierAccount, poolAccount] = await Promise.all([
    fetchWhirlpoolsConfig(rpc, WHIRLPOOLS_CONFIG_ADDRESS),
    fetchFeeTier(rpc, feeTierAddress),
    fetchMaybeWhirlpool(rpc, poolAddress)
  ]);

  if (poolAccount.exists) {
    return {
      initialized: true,
      address: poolAddress,
      ...poolAccount.data,
    };
  } else {
    return {
      initialized: false,
      address: poolAddress,
      whirlpoolsConfig: WHIRLPOOLS_CONFIG_ADDRESS,
      tickSpacing,
      feeRate: feeTierAccount.data.defaultFeeRate,
      protocolFeeRate: configAccount.data.defaultProtocolFeeRate,
      tokenMintA: tokenMintA,
      tokenMintB: tokenMintB,
    };
  }
}

export async function fetchPools(rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>, tokenMintOne: Address, tokenMintTwo: Address): Promise<PoolInfo[]> {
  const [tokenMintA, tokenMintB] = Buffer.from(tokenMintOne) < Buffer.from(tokenMintTwo) ? [tokenMintOne, tokenMintTwo] : [tokenMintTwo, tokenMintOne];

  const feeTierAddressesPromise = Promise.all(
    SUPPORTED_TICK_SPACINGS.map(x =>
      getFeeTierAddress(WHIRLPOOLS_CONFIG_ADDRESS, x).then(x => x[0])
    )
  );

  const poolAddressesPromise = Promise.all(
    SUPPORTED_TICK_SPACINGS.map(x =>
      getWhirlpoolAddress(WHIRLPOOLS_CONFIG_ADDRESS, tokenMintA, tokenMintB, x).then(x => x[0])
    )
  );

  const [feeTierAddresses, poolAddresses] = await Promise.all([
    feeTierAddressesPromise,
    poolAddressesPromise
  ]);

  // TODO: this is multiple rpc calls. Can we do it in one?
  const [configAccount, feeTierAccounts, poolAccounts] = await Promise.all([
    fetchWhirlpoolsConfig(rpc, WHIRLPOOLS_CONFIG_ADDRESS),
    fetchAllMaybeFeeTier(rpc, feeTierAddresses),
    fetchAllMaybeWhirlpool(rpc, poolAddresses)
  ]);

  const pools: PoolInfo[] = [];
  for (let i = 0; i < SUPPORTED_TICK_SPACINGS.length; i++) {
    const tickSpacing = SUPPORTED_TICK_SPACINGS[i];
    const feeTierAccount = feeTierAccounts[i];
    const poolAccount = poolAccounts[i];
    const poolAddress = poolAddresses[i];

    if (!feeTierAccount.exists) {
      continue;
    }

    if (poolAccount.exists) {
      pools.push({
        initialized: true,
        address: poolAddress,
        ...poolAccount.data,
      });
    } else {
      pools.push({
        initialized: false,
        address: poolAddress,
        whirlpoolsConfig: WHIRLPOOLS_CONFIG_ADDRESS,
        tickSpacing,
        feeRate: feeTierAccount.data.defaultFeeRate,
        protocolFeeRate: configAccount.data.defaultProtocolFeeRate,
        tokenMintA,
        tokenMintB,
      });
    }
  }
  return pools;
}

type CreatePoolInstructions = {
  instructions: IInstruction[];
  poolAddress: Address;
}

export function createSplashPool(rpc: Rpc<GetMultipleAccountsApi>, tokenMintOne: Address, tokenMintTwo: Address, initialPrice: number = 1, funder: TransactionPartialSigner = DEFAULT_FUNDER): Promise<CreatePoolInstructions> {
  return createPool(rpc, tokenMintOne, tokenMintTwo, SPLASH_POOL_TICK_SPACING, initialPrice, funder);
}

export async function createPool(rpc: Rpc<GetMultipleAccountsApi>, tokenMintOne: Address, tokenMintTwo: Address, tickSpacing: number, initialPrice: number = 1, funder: TransactionPartialSigner = DEFAULT_FUNDER): Promise<CreatePoolInstructions> {
  invariant(funder.address !== DEFAULT_ADDRESS, "Either supply a funder or set the default funder");
  const [tokenMintA, tokenMintB] = Buffer.from(tokenMintOne) < Buffer.from(tokenMintTwo) ? [tokenMintOne, tokenMintTwo] : [tokenMintTwo, tokenMintOne];
  const instructions: IInstruction[] = [];

  // Since TE mint data is an extension of T mint data, we can use the same fetch function
  const [mintA, mintB] = await fetchAllMint(rpc, [tokenMintA, tokenMintB]);
  const decimalsA = mintA.data.decimals;
  const decimalsB = mintB.data.decimals;
  const tokenProgramA = mintA.programAddress;
  const tokenProgramB = mintB.programAddress;

  const initialSqrtPrice = priceToSqrtPrice(initialPrice, decimalsA, decimalsB);

  const [poolAddress, feeTier, tokenBadgeA, tokenBadgeB, tokenVaultA, tokenVaultB] = await Promise.all([
    getWhirlpoolAddress(WHIRLPOOLS_CONFIG_ADDRESS, tokenMintA, tokenMintB, tickSpacing).then(x => x[0]),
    getFeeTierAddress(WHIRLPOOLS_CONFIG_ADDRESS, tickSpacing).then(x => x[0]),
    getTokenBadgeAddress(WHIRLPOOLS_CONFIG_ADDRESS, tokenMintA).then(x => x[0]),
    getTokenBadgeAddress(WHIRLPOOLS_CONFIG_ADDRESS, tokenMintB).then(x => x[0]),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  instructions.push(
    getInitializePoolV2Instruction({
      whirlpoolsConfig: WHIRLPOOLS_CONFIG_ADDRESS,
      tokenMintA,
      tokenMintB,
      tokenBadgeA,
      tokenBadgeB,
      funder,
      whirlpool: poolAddress,
      tokenVaultA,
      tokenVaultB,
      tokenProgramA,
      tokenProgramB,
      feeTier,
      tickSpacing,
      initialSqrtPrice,
    })
  );

  const fullRange = getFullRangeTickIndexes(tickSpacing);
  const lowerTickIndex = getTickArrayStartTickIndex(fullRange.tickLowerIndex, tickSpacing);
  const upperTickIndex = getTickArrayStartTickIndex(fullRange.tickUpperIndex, tickSpacing);
  const initialTickIndex = sqrtPriceToTickIndex(initialSqrtPrice);
  const currentTickIndex = getTickArrayStartTickIndex(initialTickIndex, tickSpacing);

  const [lowerTickArrayAddress, upperTickArrayAddress, currentTickArrayAddress] = await Promise.all([
    getTickArrayAddress(poolAddress, lowerTickIndex).then(x => x[0]),
    getTickArrayAddress(poolAddress, upperTickIndex).then(x => x[0]),
    getTickArrayAddress(poolAddress, currentTickIndex).then(x => x[0]),
  ])

  instructions.push(
    getInitializeTickArrayInstruction({
      whirlpool: poolAddress,
      funder,
      tickArray: lowerTickArrayAddress,
      startTickIndex: lowerTickIndex,
    })
  );

  instructions.push(
    getInitializeTickArrayInstruction({
      whirlpool: poolAddress,
      funder,
      tickArray: upperTickArrayAddress,
      startTickIndex: upperTickIndex,
    })
  );

  if (currentTickIndex !== lowerTickIndex && currentTickIndex !== upperTickIndex) {
    instructions.push(
      getInitializeTickArrayInstruction({
        whirlpool: poolAddress,
        funder,
        tickArray: currentTickArrayAddress,
        startTickIndex: currentTickIndex,
      })
    )
  }

  return {
    instructions,
    poolAddress,
  };
}
