import type { Whirlpool } from "@orca-so/whirlpools-client";
import {
  getFeeTierAddress,
  getWhirlpoolAddress,
  fetchWhirlpoolsConfig,
  fetchFeeTier,
  fetchMaybeWhirlpool,
  fetchAllMaybeFeeTier,
  fetchAllMaybeWhirlpool,
} from "@orca-so/whirlpools-client";
import type {
  Rpc,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  Address,
} from "@solana/web3.js";
import {
  SPLASH_POOL_TICK_SPACING,
  WHIRLPOOLS_CONFIG_ADDRESS,
  SUPPORTED_TICK_SPACINGS,
} from "./config";

type InitializablePool = {
  initialized: false;
} & Pick<
  Whirlpool,
  | "whirlpoolsConfig"
  | "tickSpacing"
  | "feeRate"
  | "protocolFeeRate"
  | "tokenMintA"
  | "tokenMintB"
>;

type InitializedPool = {
  initialized: true;
} & Whirlpool;

type PoolInfo = (InitializablePool | InitializedPool) & { address: Address };

export async function fetchSplashPool(
  rpc: Rpc<GetAccountInfoApi>,
  tokenMintOne: Address,
  tokenMintTwo: Address,
): Promise<PoolInfo> {
  return fetchPool(rpc, tokenMintOne, tokenMintTwo, SPLASH_POOL_TICK_SPACING);
}

export async function fetchPool(
  rpc: Rpc<GetAccountInfoApi>,
  tokenMintOne: Address,
  tokenMintTwo: Address,
  tickSpacing: number,
): Promise<PoolInfo> {
  const [tokenMintA, tokenMintB] =
    Buffer.from(tokenMintOne) < Buffer.from(tokenMintTwo)
      ? [tokenMintOne, tokenMintTwo]
      : [tokenMintTwo, tokenMintOne];
  const feeTierAddress = await getFeeTierAddress(
    WHIRLPOOLS_CONFIG_ADDRESS,
    tickSpacing,
  ).then((x) => x[0]);
  const poolAddress = await getWhirlpoolAddress(
    WHIRLPOOLS_CONFIG_ADDRESS,
    tokenMintA,
    tokenMintB,
    tickSpacing,
  ).then((x) => x[0]);

  // TODO: this is multiple rpc calls. Can we do it in one?
  const [configAccount, feeTierAccount, poolAccount] = await Promise.all([
    fetchWhirlpoolsConfig(rpc, WHIRLPOOLS_CONFIG_ADDRESS),
    fetchFeeTier(rpc, feeTierAddress),
    fetchMaybeWhirlpool(rpc, poolAddress),
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

export async function fetchPools(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  tokenMintOne: Address,
  tokenMintTwo: Address,
): Promise<PoolInfo[]> {
  const [tokenMintA, tokenMintB] =
    Buffer.from(tokenMintOne) < Buffer.from(tokenMintTwo)
      ? [tokenMintOne, tokenMintTwo]
      : [tokenMintTwo, tokenMintOne];

  const feeTierAddressesPromise = Promise.all(
    SUPPORTED_TICK_SPACINGS.map((x) =>
      getFeeTierAddress(WHIRLPOOLS_CONFIG_ADDRESS, x).then((x) => x[0]),
    ),
  );

  const poolAddressesPromise = Promise.all(
    SUPPORTED_TICK_SPACINGS.map((x) =>
      getWhirlpoolAddress(
        WHIRLPOOLS_CONFIG_ADDRESS,
        tokenMintA,
        tokenMintB,
        x,
      ).then((x) => x[0]),
    ),
  );

  const [feeTierAddresses, poolAddresses] = await Promise.all([
    feeTierAddressesPromise,
    poolAddressesPromise,
  ]);

  // TODO: this is multiple rpc calls. Can we do it in one?
  const [configAccount, feeTierAccounts, poolAccounts] = await Promise.all([
    fetchWhirlpoolsConfig(rpc, WHIRLPOOLS_CONFIG_ADDRESS),
    fetchAllMaybeFeeTier(rpc, feeTierAddresses),
    fetchAllMaybeWhirlpool(rpc, poolAddresses),
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
