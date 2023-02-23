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

export type BestRoutesResult = BestRoutesSuccess | BestRoutesError;
type BestRoutesSuccess = {
  success: true;
  bestRoutes: WhirlpoolRoute[];
};

type BestRoutesError = {
  success: false;
  error: RouteQueryError;
  stack?: string;
};

export enum RouteQueryError {
  ROUTE_DOES_NOT_EXIST = "ROUTE_DOES_NOT_EXIST",
  TRADE_AMOUNT_TOO_HIGH = "TRADE_AMOUNT_TOO_HIGH",
  ZERO_INPUT_AMOUNT = "ZERO_INPUT_AMOUNT",
  GENERAL = "GENERAL",
}

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
