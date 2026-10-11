//! Pure, deterministic Zyzz compilation: source extraction, CSS emission, and module rewriting.
//!
//! Modules mirror the TypeScript tree under `src/`. The crate reads no files, environment, or
//! clock, so identical inputs always produce identical output. Hosts reach it through
//! `zyzz_binding`.

pub mod data;
pub mod error;
pub mod generated;
pub mod internal;
pub mod js;
pub mod style;
pub mod vars;
