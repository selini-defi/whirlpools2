import type {
  CollectFeesQuote,
  CollectRewardsQuote,
} from "@orca-so/whirlpools-core";
import {
  collectFeesQuote,
  collectRewardsQuote,
  getTickArrayStartTickIndex,
} from "@orca-so/whirlpools-core";
import type {
  Rpc,
  GetAccountInfoApi,
  Address,
  IInstruction,
  TransactionPartialSigner,
  GetMultipleAccountsApi,
} from "@solana/web3.js";
import invariant from "tiny-invariant";
import { DEFAULT_ADDRESS, DEFAULT_FUNDER } from "./config";
import {
  fetchAllTickArray,
  fetchPosition,
  fetchWhirlpool,
  getCollectFeesInstruction,
  getCollectRewardInstruction,
  getPositionAddress,
  getTickArrayAddress,
} from "@orca-so/whirlpools-client";
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { prepareTokenAccountsInstructions } from "./token";

type HarvestPositionInstructions = {
  feesQuote: CollectFeesQuote;
  rewardsQuote: CollectRewardsQuote;
  instructions: IInstruction[];
};

export async function harvestPositionInstructions(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  positionMint: Address,
  authority: TransactionPartialSigner = DEFAULT_FUNDER,
): Promise<HarvestPositionInstructions> {
  invariant(
    authority.address !== DEFAULT_ADDRESS,
    "Either supply an authority or set the default funder",
  );
  const instructions: IInstruction[] = [];

  const positionAddress = await getPositionAddress(positionMint);
  const position = await fetchPosition(rpc, positionAddress[0]);
  const whirlpool = await fetchWhirlpool(rpc, position.data.whirlpool);

  const lowerTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickLowerIndex,
    whirlpool.data.tickSpacing,
  );
  const upperTickArrayStartIndex = getTickArrayStartTickIndex(
    position.data.tickUpperIndex,
    whirlpool.data.tickSpacing,
  );

  const [positionTokenAccount, lowerTickArrayAddress, upperTickArrayAddress] =
    await Promise.all([
      findAssociatedTokenPda({
        owner: authority.address,
        mint: positionMint,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }).then((x) => x[0]),
      getTickArrayAddress(whirlpool.address, lowerTickArrayStartIndex).then(
        (x) => x[0],
      ),
      getTickArrayAddress(whirlpool.address, upperTickArrayStartIndex).then(
        (x) => x[0],
      ),
    ]);

  const [lowerTickArray, upperTickArray] = await fetchAllTickArray(rpc, [
    lowerTickArrayAddress,
    upperTickArrayAddress,
  ]);

  const feesQuote = collectFeesQuote(
    whirlpool.data,
    position.data,
    lowerTickArray.data,
    upperTickArray.data,
  );
  const currentUnixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const rewardsQuote = collectRewardsQuote(
    whirlpool.data,
    position.data,
    lowerTickArray.data,
    upperTickArray.data,
    currentUnixTimestamp,
  );

  const { createInstructions, cleanupInstructions, tokenAccountAddresses } =
    await prepareTokenAccountsInstructions(rpc, authority, [
      whirlpool.data.tokenMintA,
      whirlpool.data.tokenMintB,
      whirlpool.data.rewardInfos[0].mint,
      whirlpool.data.rewardInfos[1].mint,
      whirlpool.data.rewardInfos[2].mint,
    ]);

  instructions.push(...createInstructions);

  instructions.push(
    getCollectFeesInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA: tokenAccountAddresses[whirlpool.data.tokenMintA],
      tokenOwnerAccountB: tokenAccountAddresses[whirlpool.data.tokenMintB],
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
    }),
  );

  if (rewardsQuote.rewardOwed1 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[0].mint],
        rewardVault: whirlpool.data.rewardInfos[0].vault,
        rewardIndex: 0,
      }),
    );
  }

  if (rewardsQuote.rewardOwed2 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[1].mint],
        rewardVault: whirlpool.data.rewardInfos[1].vault,
        rewardIndex: 1,
      }),
    );
  }

  if (rewardsQuote.rewardOwed3 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount:
          tokenAccountAddresses[whirlpool.data.rewardInfos[2].mint],
        rewardVault: whirlpool.data.rewardInfos[2].vault,
        rewardIndex: 2,
      }),
    );
  }

  instructions.push(...cleanupInstructions);

  return {
    feesQuote,
    rewardsQuote,
    instructions,
  };
}
