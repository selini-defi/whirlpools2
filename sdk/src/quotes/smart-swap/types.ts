import { u64 } from "@solana/spl-token";
import { SwapErrorCode } from "../../errors/errors";
import { RouteHop } from "../public";

export type InternalRouteQuote = {
  // An array of pools (id-ed by PoolKey) to complete an exchange between tokenA -> tokenB
  route: string[];
  percent: number;
  amountIn: u64;
  amountOut: u64;
  calculatedHops: (RouteHopResult | undefined)[];
};

export type RouteHopResult = RouteHop | RouteHopError;

type RouteHopError = {
  success: false;
  error: SwapErrorCode;
};
