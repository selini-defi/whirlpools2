import { Program } from "@project-serum/anchor";
import { Whirlpool } from "../artifacts/whirlpool";
import { Instruction } from "@orca-so/common-sdk";
import { PublicKey } from "@solana/web3.js";

export type SetLookupReferenceParams = {
  whirlpoolsConfig: PublicKey;
  authority: PublicKey,
  accIndex: number;
  lookupAccount: PublicKey;
  lookupReference: PublicKey;
};

export function setLookupReference(
  program: Program<Whirlpool>,
  params: SetLookupReferenceParams
): Instruction {
  const {
    whirlpoolsConfig,
    authority,
    accIndex,
    lookupAccount,
    lookupReference,
  } = params;

  const ix = program.instruction.setLookupReference(accIndex, {
    accounts: {
      whirlpoolsConfig,
      authority,
      lookupReference,
      lookupTable: lookupAccount,
    },
  });

  return {
    instructions: [ix],
    cleanupInstructions: [],
    signers: [],
  };
}
