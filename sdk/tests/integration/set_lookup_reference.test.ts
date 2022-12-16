import * as anchor from "@project-serum/anchor";
import { toTx, WhirlpoolContext, WhirlpoolIx } from "../../src";
import { initLookupRef, initLookupTable } from "../utils/init-utils";
import { generateDefaultConfigParams } from "../utils/test-builders";

describe("set_lookup_reference", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Whirlpool;
  const ctx = WhirlpoolContext.fromWorkspace(provider, program);
  const fetcher = ctx.fetcher;

  it("successfully set_lookup_reference", async () => {
    const { configInitInfo, configKeypairs } = generateDefaultConfigParams(ctx);

    await toTx(ctx, WhirlpoolIx.initializeConfigIx(ctx.program, configInitInfo)).buildAndExecute();
    
    const { params } = await initLookupRef(
      ctx,
      configInitInfo.whirlpoolsConfigKeypair.publicKey,
    );

    let lookupReference = (await fetcher.getLookupReference(params.lookupPda.publicKey));

    const { lookupTableAddress }= await initLookupTable(ctx, [configInitInfo.whirlpoolsConfigKeypair.publicKey]);
      
    await toTx(ctx, WhirlpoolIx.setLookupReference(ctx.program, {
      whirlpoolsConfig: configInitInfo.whirlpoolsConfigKeypair.publicKey,
      accIndex: 0,
      authority: configKeypairs.feeAuthorityKeypair.publicKey,
      lookupAccount: lookupTableAddress,
      lookupReference: params.lookupPda.publicKey,  
    })).addSigner(configKeypairs.feeAuthorityKeypair).buildAndExecute();
    lookupReference = (await fetcher.getLookupReference(params.lookupPda.publicKey, true));
  });
});
