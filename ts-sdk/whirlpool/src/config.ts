import { getWhirlpoolsConfigExtensionAddress } from "@orca-so/whirlpools-client";
import { _SUPPORTED_TICK_SPACINGS } from "@orca-so/whirlpools-core";
import type { Address, TransactionPartialSigner } from "@solana/web3.js";
import { address, createNoopSigner } from "@solana/web3.js";

export const DEFAULT_ADDRESS = address("11111111111111111111111111111111");

export let WHIRLPOOLS_CONFIG_ADDRESS: Address = address(
  "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ",
);
export let WHIRLPOOLS_CONFIG_EXTENSION_ADDRESS: Address = address(
  "777H5H3Tp9U11uRVRzFwM8BinfiakbaLT8vQpeuhvEiH",
);

export async function setWhirlpoolsConfig(
  configAddress: Address,
): Promise<void> {
  WHIRLPOOLS_CONFIG_ADDRESS = configAddress;
  WHIRLPOOLS_CONFIG_EXTENSION_ADDRESS =
    await getWhirlpoolsConfigExtensionAddress(configAddress).then((x) => x[0]);
}

export let SUPPORTED_TICK_SPACINGS: number[] = _SUPPORTED_TICK_SPACINGS();

export function setSupportedTickSpacings(tickSpacings: number[]): void {
  SUPPORTED_TICK_SPACINGS = tickSpacings;
}

export const SPLASH_POOL_TICK_SPACING = 32896;

export let DEFAULT_FUNDER: TransactionPartialSigner =
  createNoopSigner(DEFAULT_ADDRESS);

export function setDefaultFunder(
  funder: TransactionPartialSigner | Address,
): void {
  if ("address" in funder) {
    DEFAULT_FUNDER = funder;
  } else {
    DEFAULT_FUNDER = createNoopSigner(funder);
  }
}

export let DEFAULT_SLIPPAGE_TOLERANCE = 0.01;

export function setDefaultSlippageTolerance(slippageTolerance: number): void {
  DEFAULT_SLIPPAGE_TOLERANCE = slippageTolerance;
}

/**
 * Keypair:
 * Create auxillary token account using keypair.
 * Optionally add funds to account.
 * Close account at the end of tx.
 *
 * Seed:
 * Same as Keypair but then with a seed account.
 *
 * ATA:
 * Create ata (if needed) for NATIVE_MINT
 * Optionally add funds to ata.
 * Close ata at the end of tx if it did not exist before the tx.
 *
 * None:
 * Use/create ata and do not do any wrapping / unwrapping of SOL
 */
export type SolWrappingStrategy = "keypair" | "seed" | "ata" | "none";

export let SOL_WRAPPING_STRATEGY: SolWrappingStrategy = "ata";

export function setSolWrappingStrategy(strategy: SolWrappingStrategy): void {
  SOL_WRAPPING_STRATEGY = strategy;
}

export async function resetConfiguration(): Promise<void> {
  setWhirlpoolsConfig(address("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ"));
  setSupportedTickSpacings(_SUPPORTED_TICK_SPACINGS());
  setDefaultFunder(DEFAULT_ADDRESS);
  setDefaultSlippageTolerance(0.01);
  setSolWrappingStrategy("ata");
}
