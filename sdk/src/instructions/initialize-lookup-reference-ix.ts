import { SystemProgram, PublicKey, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { Whirlpool } from "../artifacts/whirlpool";

import { Instruction, PDA } from "@orca-so/common-sdk";

export type InitLookupReferenceParams = {
  whirlpoolsConfig: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  funder: PublicKey;
  lookupPda: PDA;
};

/**
 * Initializes a fee tier account usable by Whirlpools in this WhirlpoolsConfig space.
 *
 *  Special Errors
 * `FeeRateMaxExceeded` - If the provided default_fee_rate exceeds MAX_FEE_RATE.
 *
 * @category Instructions
 * @param context - Context object containing services required to generate the instruction
 * @param params - InitFeeTierParams object
 * @returns - Instruction to perform the action.
 */
export function initializeLookupReferenceIx(
  program: Program<Whirlpool>,
  params: InitLookupReferenceParams
): Instruction {
  const { whirlpoolsConfig, tokenMintA, tokenMintB, funder, lookupPda} = params;

  const ix = program.instruction.initializeLookupReference({
    accounts: {
      whirlpoolsConfig,
      tokenMintA,
      tokenMintB,
      funder,
      lookupReference: lookupPda.publicKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    },
  });

  return {
    instructions: [ix],
    cleanupInstructions: [],
    signers: [],
  };
}
