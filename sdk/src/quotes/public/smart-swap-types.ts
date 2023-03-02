import { Address } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { InternalRouteQuote } from "../smart-swap/types";
import { SwapQuote } from "./swap-quote";

export type WhirlpoolRoute = {
  quotes: RouteQuote[];
  percent: number;
  totalIn: u64;
  totalOut: u64;
};

export type RouteQuote = Omit<InternalRouteQuote, "calculatedHops"> & {
  calculatedHops: RouteHop[];
};

export type RouteHop = {
  success: true;
  percent: number;
  amountIn: u64;
  amountOut: u64;
  whirlpool: Address;
  inputMint: Address;
  outputMint: Address;
  mintA: Address;
  mintB: Address;
  vaultA: Address;
  vaultB: Address;
  quote: SwapQuote;
};
