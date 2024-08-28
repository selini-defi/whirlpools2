import { createSolanaRpcFromTransport, getBase58Decoder, getBase64Decoder, VariableSizeDecoder } from "@solana/web3.js";
import assert from "assert";
import { DEFAULT_ADDRESS } from "../src/config";

const mockAccounts: Record<string, Uint8Array> = {

};

const decoders: Record<string, VariableSizeDecoder<string>> = {
  base58: getBase58Decoder(),
  base64: getBase64Decoder()
}

function getAccountData<T>(address: unknown, opts: unknown): unknown {
  assert(typeof opts === "object")
  assert(opts != null);
  assert("encoding" in opts);
  assert(typeof opts.encoding === "string");

  const decoder = decoders[opts.encoding];
  if (decoder == null) {
    throw new Error(`No decoder found for ${opts}`);
  }

  assert(typeof address === "string");
  const data = mockAccounts[address];
  if (data == null) {
    throw new Error(`No mock account found for ${address}`);
  }
  return {
    data: [decoder.decode(data), opts.encoding],
    executable: false,
    lamports: data.length * 10,
    // Since no ownership checks are don in fetch code this doesn't really matter
    owner: DEFAULT_ADDRESS,
    rentEpoch: 0,
    space: data.length
  } as T;
}

function getResponse<T>(value: unknown): T {
  return {
    jsonrpc: "2.0",
    result: {
      context: {
        slot: 1
      },
      value
    }
  } as T
}

function mockTransport<T>(config:  Readonly<{
  payload: unknown;
  signal?: AbortSignal;
}>): Promise<T> {
  assert(typeof config.payload === "object");
  assert(config.payload != null);
  assert("method" in config.payload);
  assert(typeof config.payload.method === "string");
  assert("params" in config.payload);
  assert(Array.isArray(config.payload.params))

  switch (config.payload.method) {
    case "getAccountInfo":
      const address = config.payload.params[0];
      assert(typeof address === "string");
      const accountData = getAccountData(address, config.payload.params[1]);
      return Promise.resolve(getResponse<T>(accountData));
    case "getMultipleAccounts":
      const addresses = config.payload.params[0];
      const opts = config.payload.params[1];
      assert(Array.isArray(addresses))
      const accountsData = addresses.map(x => getAccountData(x, opts))
      return Promise.resolve(getResponse<T>(accountsData));
    case "getMinimumBalanceForRentExemption":
      const space = config.payload.params[0];
      assert(typeof space === "number");
      return Promise.resolve(getResponse<T>(space * 10));
  }
  return Promise.reject(`Method ${config.payload.method} not supported in mock transport`)
}

export const rpc = createSolanaRpcFromTransport(mockTransport)
