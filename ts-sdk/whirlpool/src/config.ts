import { WHIRLPOOL_PROGRAM_ADDRESS } from "@orca-so/whirlpools-client";
import { _SUPPORTED_TICK_SPACINGS } from "@orca-so/whirlpools-core";
import { Address, address, getProgramDerivedAddress } from "@solana/web3.js";

export let WHIRLPOOL_CONFIG_ADDRESS: Address = address("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");
export let WHIRLPOOL_CONFIG_EXTENSION_ADDRESS: Address = address("777H5H3Tp9U11uRVRzFwM8BinfiakbaLT8vQpeuhvEiH");

export async function setWhirlpoolsConfig(configAddress: Address): Promise<void> {
  WHIRLPOOL_CONFIG_ADDRESS = configAddress;
  WHIRLPOOL_CONFIG_EXTENSION_ADDRESS = await getProgramDerivedAddress({
    programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
    seeds: ["config_extension", configAddress],
  }).then(x => x[0]);
}

export let SUPPORTED_TICK_SPACINGS = _SUPPORTED_TICK_SPACINGS();

export function setSupportedTickSpacings(tickSpacings: number[]): void {
  SUPPORTED_TICK_SPACINGS = tickSpacings;
}
