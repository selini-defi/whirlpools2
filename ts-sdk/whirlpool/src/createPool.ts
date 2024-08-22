import { Whirlpool } from '@orca-so/whirlpools-client';
import { Address } from '@solana/web3.js';


type InitializablePool = {
  initialized: false;
} & Pick<Whirlpool, "whirlpoolsConfig" | "tickSpacing" | "feeRate" | "protocolFeeRate" | "tokenMintA" | "tokenMintB">;

type InitializedPool = {
  initialized: true;
} & Whirlpool;

export function fetchPools(mint: Address): Promise<void> {

  return Promise.resolve();
}
