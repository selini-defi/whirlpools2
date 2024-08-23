#![allow(non_snake_case)]

#[cfg(feature = "wasm")]
use orca_whirlpools_macros::export_ts_const;

/// The number of ticks in a tick array.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const TICK_ARRAY_SIZE: usize = 88;

/// Pools with tick spacing above this threshold are considered full range only.
/// This means the program rejects any non-full range positions in these pools.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const FULL_RANGE_ONLY_TICK_SPACING_THRESHOLD: u16 = 32768; // 2^15

/// The minimum tick index.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const MIN_TICK_INDEX: i32 = -443636;

/// The maximum tick index.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const MAX_TICK_INDEX: i32 = 443636;

/// The minimum sqrt price supported by the program.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const MIN_SQRT_PRICE: u128 = 4295048016;

/// The maximum sqrt price supported by the program.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const MAX_SQRT_PRICE: u128 = 79226673515401279992447579055;

/// The default supported tick spacings through the Orca config.
#[cfg_attr(feature = "wasm", export_ts_const)]
pub const SUPPORTED_TICK_SPACINGS: &[u16] = &[1, 2, 4, 8, 16, 64, 96, 128, 256, 32896];
