import { Percentage } from "@orca-so/common-sdk";
import BN from "bn.js";

export function adjustForSlippage(
  n: BN,
  { numerator, denominator }: Percentage,
  adjustUp: boolean
): BN {
  if (adjustUp) {
    return n.mul(denominator.add(numerator)).div(denominator);
  } else {
    return n.mul(denominator).div(denominator.add(numerator));
  }
}