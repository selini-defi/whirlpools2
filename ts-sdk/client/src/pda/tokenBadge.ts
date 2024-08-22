import type {
  Address,
  ProgramDerivedAddress,
} from "@solana/web3.js";
import {
  getProgramDerivedAddress,
} from "@solana/web3.js";
import { WHIRLPOOL_PROGRAM_ADDRESS } from "../generated/programs/whirlpool";

export async function getTokenBadgeAddress(whirlpoolsConfig: Address, tokenMint: Address): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
    seeds: ["token_badge", whirlpoolsConfig, tokenMint],
  });
}
