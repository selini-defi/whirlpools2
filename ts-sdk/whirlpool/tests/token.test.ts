import { describe, it } from "mocha";
import { mockAccounts, rpc, TOKEN_MINT_1, TOKEN_MINT_2 } from "./mockRpc";
import { AccountState, findAssociatedTokenPda, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { DEFAULT_ADDRESS, resetConfiguration, setSolWrappingStrategy } from "../src/config";
import { Address, createNoopSigner, generateKeyPairSigner, TransactionSigner } from "@solana/web3.js";
import { NATIVE_MINT, prepareTokenAccountsInstructions } from "../src/token";
import assert from "assert";


describe("Token Account Creation", () => {
  let signer: TransactionSigner = createNoopSigner(DEFAULT_ADDRESS);
  let existingTokenAccount: Address = DEFAULT_ADDRESS;
  let nonExistingTokenAccount: Address = DEFAULT_ADDRESS;
  let nativeMintTokenAccount: Address = DEFAULT_ADDRESS;

  const createNativeMintTokenAccount = async () => {
    mockAccounts[nativeMintTokenAccount] = mockAccounts[existingTokenAccount] = {
      bytes: getTokenEncoder().encode({
        mint: TOKEN_MINT_1,
        owner: signer.address,
        amount: 500,
        delegate: null,
        state: AccountState.Initialized,
        isNative: null,
        delegatedAmount: 0,
        closeAuthority: null,
      }),
      owner: TOKEN_PROGRAM_ADDRESS,
    };
  }

  before(async () => {
    signer = await generateKeyPairSigner();
    [existingTokenAccount, nonExistingTokenAccount, nativeMintTokenAccount] = await Promise.all(
      [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT].map((mint) =>
        findAssociatedTokenPda({
          owner: signer.address,
          mint,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        }).then((x) => x[0]),
      ),
    );
    mockAccounts[existingTokenAccount] = {
      bytes: getTokenEncoder().encode({
        mint: TOKEN_MINT_1,
        owner: signer.address,
        amount: 500,
        delegate: null,
        state: AccountState.Initialized,
        isNative: null,
        delegatedAmount: 0,
        closeAuthority: null,
      }),
      owner: TOKEN_PROGRAM_ADDRESS,
    }
  });

  after(async () => {
    delete mockAccounts[existingTokenAccount];
  });

  afterEach(async () => {
    await resetConfiguration();
  })

  it("No native mint", async () => {
    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 2);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.createInstructions.length, 1);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
  });

  it("No native mint with balances", async () => {
    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 2);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.createInstructions.length, 1);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
  });

  it("Native mint and wrapping is none", async () => {
    setSolWrappingStrategy("none");

    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 2);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
  });

  it("Native mint and wrapping is none with balances", async () => {
    setSolWrappingStrategy("none");

    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n,
      [NATIVE_MINT]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 2);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
  });

  it("Native mint and wrapping is ata", async () => {
    setSolWrappingStrategy("ata");

    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 2);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

  it("Native mint and wrapping is ata but already exists", async () => {
    setSolWrappingStrategy("ata");
    await createNativeMintTokenAccount();

    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 1);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
    // TODO: check instruction?

    delete mockAccounts[nativeMintTokenAccount];
  });

  it("Native mint and wrapping is ata with balances", async () => {
    setSolWrappingStrategy("ata");

    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n,
      [NATIVE_MINT]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 4);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

  it("Native mint and wrapping is ata but already exists with balances", async () => {
    setSolWrappingStrategy("ata");
    await createNativeMintTokenAccount();

    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n,
      [NATIVE_MINT]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 3);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 0);
    // TODO: check instruction?

    delete mockAccounts[nativeMintTokenAccount];
  });

  it("Native mint and wrapping is seed", async () => {
    setSolWrappingStrategy("seed");

    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    // TODO: Actual check of the address to see if it was seed?
    assert.notStrictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 2);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

  it("Native mint and wrapping is seed with balances", async () => {
    setSolWrappingStrategy("seed");

    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n,
      [NATIVE_MINT]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);

    assert.notStrictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 4);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

  it("Native mint and wrapping is keypair", async () => {
    setSolWrappingStrategy("keypair");

    const result = await prepareTokenAccountsInstructions(rpc, signer, [TOKEN_MINT_1, TOKEN_MINT_2, NATIVE_MINT]);

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.notStrictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 2);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

  it("Native mint and wrapping is keypair with balances", async () => {
    setSolWrappingStrategy("keypair");

    const result = await prepareTokenAccountsInstructions(rpc, signer, {
      [TOKEN_MINT_1]: 100n,
      [TOKEN_MINT_2]: 100n,
      [NATIVE_MINT]: 100n
    });

    assert.strictEqual(Object.keys(result.tokenAccountAddresses).length, 3);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_1], existingTokenAccount);
    assert.strictEqual(result.tokenAccountAddresses[TOKEN_MINT_2], nonExistingTokenAccount);
    assert.notStrictEqual(result.tokenAccountAddresses[NATIVE_MINT], nativeMintTokenAccount);
    assert.strictEqual(result.createInstructions.length, 4);
    // TODO: check instruction?
    assert.strictEqual(result.cleanupInstructions.length, 1);
    // TODO: check instruction?
  });

});
