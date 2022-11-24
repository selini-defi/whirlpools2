use anchor_lang::prelude::*;
use crate::state::{WhirlpoolsConfig, LookupReference};

#[derive(Accounts)]
#[instruction(acc_index: u8)]
pub struct SetLookupReference<'info> {
    pub whirlpools_config: Account<'info, WhirlpoolsConfig>,

    #[account(mut)]
    pub lookup_reference: Account<'info, LookupReference>,

    // Not sure what the authority should be here
    #[account(address = whirlpools_config.fee_authority)]
    pub authority: Signer<'info>,

    // TODO: not sure what validations to perform here
    pub lookup_table: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<SetLookupReference>,
    acc_index: u8,
) -> ProgramResult {
    Ok(ctx.accounts.lookup_reference.set_lookup_account(
        acc_index as usize,
        ctx.accounts.lookup_table.key(),
    )?)
}
