import * as anchor from "@project-serum/anchor";
import { toTx, WhirlpoolContext, WhirlpoolIx } from "../../src";
import { initLookupRef } from "../utils/init-utils";
import { generateDefaultConfigParams } from "../utils/test-builders";

describe("initialize_lookup_reference", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Whirlpool;
  const ctx = WhirlpoolContext.fromWorkspace(provider, program);
  const fetcher = ctx.fetcher;

  it("successfully init a lookup reference account", async () => {
    const { configInitInfo } = generateDefaultConfigParams(ctx);

    await toTx(ctx, WhirlpoolIx.initializeConfigIx(ctx.program, configInitInfo)).buildAndExecute();
    
    const { params } = await initLookupRef(
      ctx,
      configInitInfo.whirlpoolsConfigKeypair.publicKey,
    );

    const lookupReference = (await fetcher.getLookupReference(params.lookupPda.publicKey));
  });
});
