//! React Native static style tables: portable declarations compiled into immutable set and scheme
//! tables, and finite recipes compiled into bounded selection tables.
//!
//! Compilation reads no device state. Units, fonts, platform, and sets are explicit inputs, and
//! every unsupported semantic produces a diagnostic instead of a guess.

pub mod generated;
pub mod internal;
pub mod style_sheet;
pub mod variants;
