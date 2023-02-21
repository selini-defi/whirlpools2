import {
  AddressUtil,
  deriveATA,
  EMPTY_INSTRUCTION,
  TransactionBuilder,
  ZERO,
} from "@orca-so/common-sdk";
import { ResolvedTokenAddressInstruction } from "@orca-so/common-sdk/dist/helpers/token-instructions";
import {
  AccountInfo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import {
  PDAUtil,
  RouteSet,
  TickArrayUtil,
  twoHopSwapQuoteFromSwapQuotes,
  WhirlpoolContext,
} from "../..";
import { createAssociatedTokenAccountInstruction } from "../../utils/ata-ix-util";
import { createWSOLAccountInstructions } from "../../utils/spl-token-utils";
import { swapIx } from "../swap-ix";
import { twoHopSwapIx } from "../two-hop-swap-ix";

export type SwapFromRouteSetParams = {
  routeSet: RouteSet;
  wallet: PublicKey;
  atas: AccountInfo[] | null;
};

export async function getSwapFromRouteSet(
  ctx: WhirlpoolContext,
  params: SwapFromRouteSetParams,
  refresh: boolean = false,
  txBuilder: TransactionBuilder = new TransactionBuilder(ctx.connection, ctx.wallet)
) {
  const { routeSet, wallet, atas } = params;
  const requiredAtas = new Set<string>();
  const requiredTickArrays = [];
  let hasNativeMint = false;
  let nativeMintAmount = new u64(0);

  function addOrNative(mint: string, amount: u64) {
    if (mint === NATIVE_MINT.toBase58()) {
      hasNativeMint = true;
      nativeMintAmount = nativeMintAmount.add(amount);
    } else {
      requiredAtas.add(mint);
    }
  }
  for (let i = 0; i < routeSet.quotes.length; i++) {
    const routeFragment = routeSet.quotes[i];
    if (routeFragment.calculatedHops.length == 1) {
      const { quote, mintA, mintB } = routeFragment.calculatedHops[0];

      requiredTickArrays.push(...[quote.tickArray0, quote.tickArray1, quote.tickArray2]);

      const inputAmount = quote.amount;
      addOrNative(mintA.toString(), quote.aToB ? inputAmount : ZERO);
      addOrNative(mintB.toString(), !quote.aToB ? inputAmount : ZERO);
    } else if (routeFragment.calculatedHops.length == 2) {
      const { quote: quoteOne, mintA: mintOneA, mintB: mintOneB } = routeFragment.calculatedHops[0];
      const { quote: quoteTwo, mintA: mintTwoA, mintB: mintTwoB } = routeFragment.calculatedHops[1];
      const twoHopQuote = twoHopSwapQuoteFromSwapQuotes(quoteOne, quoteTwo);

      requiredTickArrays.push(
        ...[
          twoHopQuote.tickArrayOne0,
          twoHopQuote.tickArrayOne1,
          twoHopQuote.tickArrayOne2,
          twoHopQuote.tickArrayTwo0,
          twoHopQuote.tickArrayTwo1,
          twoHopQuote.tickArrayTwo2,
        ]
      );

      const inputAmount = quoteOne.estimatedAmountIn;
      addOrNative(mintOneA.toString(), quoteOne.aToB ? inputAmount : ZERO);
      addOrNative(mintOneB.toString(), !quoteOne.aToB ? inputAmount : ZERO);
      addOrNative(mintTwoA.toString(), ZERO);
      addOrNative(mintTwoB.toString(), ZERO);
    }
  }

  let uninitializedArrays = await TickArrayUtil.getUninitializedArraysString(
    requiredTickArrays,
    ctx.fetcher,
    refresh
  );
  if (uninitializedArrays) {
    throw new Error(`TickArray addresses - [${uninitializedArrays}] need to be initialized.`);
  }

  // Handle non-native mints only first
  requiredAtas.delete(NATIVE_MINT.toBase58());

  const ataInstructionMap = await cachedResolveOrCreateNonNativeATAs(
    wallet,
    requiredAtas,
    (keys) => {
      // TODO: if atas are not up to date, there might be failures, not sure if there's
      // any good way, other than to re-fetch each time?
      if (atas != null) {
        return Promise.resolve(
          keys.map((key) =>
            atas.find((ata) => ata.address?.toBase58() === key.toBase58())
          ) as AccountInfo[]
        );
      } else {
        return ctx.fetcher.listTokenInfos(keys, false);
      }
    }
  );

  const ataIxes = Object.values(ataInstructionMap);

  if (hasNativeMint) {
    const solIx = createWSOLAccountInstructions(
      wallet,
      nativeMintAmount,
      await ctx.fetcher.getAccountRentExempt()
    );
    txBuilder.addInstruction(solIx);
    ataInstructionMap[NATIVE_MINT.toBase58()] = solIx;
  }

  txBuilder.addInstructions(ataIxes);

  for (let i = 0; i < routeSet.quotes.length; i++) {
    const routeFragment = routeSet.quotes[i];
    if (routeFragment.calculatedHops.length == 1) {
      const { quote, whirlpool, mintA, mintB, vaultA, vaultB } = routeFragment.calculatedHops[0];
      const [wp, tokenVaultA, tokenVaultB] = AddressUtil.toPubKeys([whirlpool, vaultA, vaultB]);
      const accA = ataInstructionMap[mintA.toString()].address;
      const accB = ataInstructionMap[mintB.toString()].address;
      const oraclePda = PDAUtil.getOracle(ctx.program.programId, wp);
      txBuilder.addInstruction(
        swapIx(ctx.program, {
          whirlpool: wp,
          tokenOwnerAccountA: accA,
          tokenOwnerAccountB: accB,
          tokenVaultA,
          tokenVaultB,
          oracle: oraclePda.publicKey,
          tokenAuthority: wallet,
          ...quote,
        })
      );
    } else if (routeFragment.calculatedHops.length == 2) {
      const {
        quote: quoteOne,
        whirlpool: whirlpoolOne,
        mintA: mintOneA,
        mintB: mintOneB,
        vaultA: vaultOneA,
        vaultB: vaultOneB,
      } = routeFragment.calculatedHops[0];
      const {
        quote: quoteTwo,
        whirlpool: whirlpoolTwo,
        mintA: mintTwoA,
        mintB: mintTwoB,
        vaultA: vaultTwoA,
        vaultB: vaultTwoB,
      } = routeFragment.calculatedHops[1];

      const [wpOne, wpTwo, tokenVaultOneA, tokenVaultOneB, tokenVaultTwoA, tokenVaultTwoB] =
        AddressUtil.toPubKeys([
          whirlpoolOne,
          whirlpoolTwo,
          vaultOneA,
          vaultOneB,
          vaultTwoA,
          vaultTwoB,
        ]);
      const twoHopQuote = twoHopSwapQuoteFromSwapQuotes(quoteOne, quoteTwo);

      const oracleOne = PDAUtil.getOracle(ctx.program.programId, wpOne).publicKey;
      const oracleTwo = PDAUtil.getOracle(ctx.program.programId, wpTwo).publicKey;

      const tokenOwnerAccountOneA = ataInstructionMap[mintOneA.toString()].address;
      const tokenOwnerAccountOneB = ataInstructionMap[mintOneB.toString()].address;
      const tokenOwnerAccountTwoA = ataInstructionMap[mintTwoA.toString()].address;
      const tokenOwnerAccountTwoB = ataInstructionMap[mintTwoB.toString()].address;
      txBuilder.addInstruction(
        twoHopSwapIx(ctx.program, {
          ...twoHopQuote,
          whirlpoolOne: wpOne,
          whirlpoolTwo: wpTwo,
          tokenOwnerAccountOneA,
          tokenOwnerAccountOneB,
          tokenOwnerAccountTwoA,
          tokenOwnerAccountTwoB,
          tokenVaultOneA,
          tokenVaultOneB,
          tokenVaultTwoA,
          tokenVaultTwoB,
          oracleOne,
          oracleTwo,
          tokenAuthority: wallet,
        })
      );
    }
  }
  return txBuilder;
}

/**
 * Internal duplicate of resolveOrCreateAta
 * This could be ported over to common-sdk?
 *
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param payer Payer that would pay the rent for the creation of the ATAs
 * @param modeIdempotent Optional. Use CreateIdempotent instruction instead of Create instruction
 * @returns
 */
export async function cachedResolveOrCreateNonNativeATAs(
  ownerAddress: PublicKey,
  tokenMints: Set<string>,
  getTokenAccounts: (keys: PublicKey[]) => Promise<Array<AccountInfo | null>>,
  payer = ownerAddress,
  modeIdempotent: boolean = false
): Promise<{ [tokenMint: string]: ResolvedTokenAddressInstruction }> {
  const instructionMap: { [tokenMint: string]: ResolvedTokenAddressInstruction } = {};
  const tokenMintArray = Array.from(tokenMints).map((tm) => new PublicKey(tm));
  const tokenAtas = await Promise.all(tokenMintArray.map((tm) => deriveATA(ownerAddress, tm)));
  const tokenAccounts = await getTokenAccounts(tokenAtas);
  tokenAccounts.forEach((tokenAccount, index) => {
    const ataAddress = tokenAtas[index]!;
    let resolvedInstruction;
    if (tokenAccount) {
      // ATA whose owner has been changed is abnormal entity.
      // To prevent to send swap/withdraw/collect output to the ATA, an error should be thrown.
      if (!tokenAccount.owner.equals(ownerAddress)) {
        throw new Error(`ATA with change of ownership detected: ${ataAddress.toBase58()}`);
      }

      resolvedInstruction = { address: ataAddress, ...EMPTY_INSTRUCTION };
    } else {
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        tokenMintArray[index],
        ataAddress,
        ownerAddress,
        payer,
        modeIdempotent
      );

      resolvedInstruction = {
        address: ataAddress,
        instructions: [createAtaInstruction],
        cleanupInstructions: [],
        signers: [],
      };
    }
    instructionMap[tokenMintArray[index].toBase58()] = resolvedInstruction;
  });

  return instructionMap;
}
