import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { AccountFetcher, PoolUtil, TokenInfo } from "..";
import {
  WhirlpoolData,
  WhirlpoolRewardInfo,
  TokenAccountInfo,
} from "../types/public";

export async function getTokenMintInfos(
  fetcher: AccountFetcher,
  data: WhirlpoolData,
  refresh: boolean
): Promise<TokenInfo[]> {
  const mintA = data.tokenMintA;
  const mintB = data.tokenMintB;
  const [infoA, infoB] = await fetcher.listMintInfos([mintA, mintB], refresh);
  if (!infoA) {
    throw new Error(`Unable to fetch MintInfo for mint - ${mintA}`);
  }
  if (!infoB) {
    throw new Error(`Unable to fetch MintInfo for mint - ${mintB}`);
  }
  return [
    { mint: mintA, ...infoA },
    { mint: mintB, ...infoB },
  ];
}

export async function getRewardInfos(
  fetcher: AccountFetcher,
  data: WhirlpoolData,
  refresh: boolean
): Promise<WhirlpoolRewardInfo[]> {
  const rewardInfos: (WhirlpoolRewardInfo | undefined) [] = [];

  const fetchIndices: number[] = [];
  const fetchVaults: PublicKey[] = [];

  for (let i = 0; i < data.rewardInfos.length; i++) {
    const rewardInfo = data.rewardInfos[i];
    if (!PoolUtil.isRewardInitialized(rewardInfo)) {
      rewardInfos.push({ ...rewardInfo, initialized: false, vaultAmount: new BN(0) });
    } else {
      rewardInfos.push(undefined);
      fetchIndices.push(i);
      fetchVaults.push(rewardInfo.vault);
    }
  }

  const vaults = await fetcher.listTokenInfos(fetchVaults, refresh);
  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i];
    const actualIndex = fetchIndices[i];
    const rewardInfo = data.rewardInfos[actualIndex];
    if (!vault) {
      throw new Error(`Unable to fetch TokenAccountInfo for vault - ${rewardInfo.vault}`);
    }
    rewardInfos[actualIndex] = {
      ...rewardInfo,
      initialized: true,
      vaultAmount: vault.amount,
    };
  }

  return rewardInfos as WhirlpoolRewardInfo[];
}

export async function getTokenVaultAccountInfos(
  fetcher: AccountFetcher,
  data: WhirlpoolData,
  refresh: boolean
): Promise<TokenAccountInfo[]> {
  const vaultA = data.tokenVaultA;
  const vaultB = data.tokenVaultB;
  const [vaultInfoA, vaultInfoB] = await fetcher.listTokenInfos([vaultA, vaultB], refresh);
  if (!vaultInfoA) {
    throw new Error(`Unable to fetch TokenAccountInfo for vault - ${vaultA}`);
  }
  if (!vaultInfoB) {
    throw new Error(`Unable to fetch TokenAccountInfo for vault - ${vaultB}`);
  }
  return [vaultInfoA, vaultInfoB];
}
