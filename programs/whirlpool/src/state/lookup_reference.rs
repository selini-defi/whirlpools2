use crate::state::WhirlpoolsConfig;
use crate::{errors::ErrorCode};
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct LookupReference {
    pub whirlpools_config: Pubkey, // 32

    pub token_mint_a: Pubkey, // 32
    pub token_mint_b: Pubkey, // 32

    // 32 * size
    pub lookup_accounts: [Pubkey; NUM_LOOKUP_ACCOUNTS],
}

pub const NUM_LOOKUP_ACCOUNTS: usize = 3;

impl LookupReference {
    pub const LEN: usize = 8 + 32 * 3 + 32 * NUM_LOOKUP_ACCOUNTS;

    pub fn initialize(
        &mut self,
        whirlpools_config: &Account<WhirlpoolsConfig>,
        token_mint_a: Pubkey,
        token_mint_b: Pubkey,
    ) -> Result<(), ErrorCode> {
        self.whirlpools_config = whirlpools_config.key();
        self.token_mint_a = token_mint_a;
        self.token_mint_b = token_mint_b;
        self.lookup_accounts = [Pubkey::default(); NUM_LOOKUP_ACCOUNTS];
        Ok(())
    }

    pub fn set_lookup_account(
        &mut self,
        index: usize,
        lookup_account: Pubkey,
    ) -> Result<(), ErrorCode> {
        self.lookup_accounts[index] = lookup_account;
        Ok(())
    }
}
