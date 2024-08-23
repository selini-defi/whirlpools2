import { collectFeesQuote, CollectFeesQuote, collectRewardsQuote, CollectRewardsQuote, getTickArrayStartTickIndex } from "@orca-so/whirlpools-core";
import { Rpc, GetAccountInfoApi, Address, IInstruction, TransactionPartialSigner, GetMultipleAccountsApi } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { DEFAULT_ADDRESS, DEFAULT_FUNDER } from "./config";
import { fetchAllTickArray, fetchPosition, fetchWhirlpool, getCollectFeesInstruction, getCollectRewardInstruction, getPositionAddress, getTickArrayAddress } from "@orca-so/whirlpools-client";
import { fetchAllMaybeToken, findAssociatedTokenPda, getCreateAssociatedTokenInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";


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

  const [
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tokenOwnerAccountReward1,
    tokenOwnerAccountReward2,
    tokenOwnerAccountReward3,
    lowerTickArrayAddress,
    upperTickArrayAddress,
  ] = await Promise.all([
    findAssociatedTokenPda({
      owner: authority.address,
      mint: positionMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintA,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.tokenMintB,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[0].mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[1].mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }).then((x) => x[0]),
    findAssociatedTokenPda({
      owner: authority.address,
      mint: whirlpool.data.rewardInfos[2].mint,
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

  const feesQuote = collectFeesQuote(whirlpool.data, position.data, lowerTickArray.data, upperTickArray.data);
  const currentUnixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const rewardsQuote = collectRewardsQuote(whirlpool.data, position.data, lowerTickArray.data, upperTickArray.data, currentUnixTimestamp);

  const ataMap = new Map([
    [tokenOwnerAccountA, whirlpool.data.tokenMintA],
    [tokenOwnerAccountB, whirlpool.data.tokenMintB],
    [tokenOwnerAccountReward1, whirlpool.data.rewardInfos[0].mint],
    [tokenOwnerAccountReward2, whirlpool.data.rewardInfos[1].mint],
    [tokenOwnerAccountReward3, whirlpool.data.rewardInfos[2].mint],
  ]);
  const ataAccounts = await fetchAllMaybeToken(rpc, Array.from(ataMap.keys()));
  const missingAtaAccounts = ataAccounts.filter(x => !x.exists);

  for (const missingAtaAccount of missingAtaAccounts) {
    instructions.push(
      getCreateAssociatedTokenInstruction({
        payer: authority,
        owner: authority.address,
        ata: missingAtaAccount.address,
        mint: ataMap.get(missingAtaAccount.address)!,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );
  }

  instructions.push(
    getCollectFeesInstruction({
      whirlpool: whirlpool.address,
      positionAuthority: authority,
      position: positionAddress[0],
      positionTokenAccount,
      tokenOwnerAccountA,
      tokenOwnerAccountB,
      tokenVaultA: whirlpool.data.tokenVaultA,
      tokenVaultB: whirlpool.data.tokenVaultB,
    })
  );

  if (rewardsQuote.rewardOwed1 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward1,
        rewardVault: whirlpool.data.rewardInfos[0].vault,
        rewardIndex: 0,
      })
    );
  }

  if (rewardsQuote.rewardOwed2 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward2,
        rewardVault: whirlpool.data.rewardInfos[1].vault,
        rewardIndex: 1,
      })
    );
  }

  if (rewardsQuote.rewardOwed3 > 0) {
    instructions.push(
      getCollectRewardInstruction({
        whirlpool: whirlpool.address,
        positionAuthority: authority,
        position: positionAddress[0],
        positionTokenAccount,
        rewardOwnerAccount: tokenOwnerAccountReward3,
        rewardVault: whirlpool.data.rewardInfos[2].vault,
        rewardIndex: 2,
      })
    );
  }

  return {
    feesQuote,
    rewardsQuote,
    instructions,
  }
}
