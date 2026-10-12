//! Pure, deterministic Zyzz compilation: source extraction, CSS emission, and module rewriting.
//!
//! Modules mirror the TypeScript tree under `src/`. The crate reads no files, environment, or
//! clock, so identical inputs always produce identical output. Hosts reach it through
//! `binding` and `wasm`.

pub mod api;
#[cfg(feature = "compiler")]
pub mod compiler;
pub mod config;
pub mod data;
pub mod error;
pub mod generated;
pub mod internal;
pub mod js;
pub mod mapping;
#[cfg(feature = "compiler")]
pub mod react_native;
pub mod runtime;
pub mod style;
pub mod vars;
pub mod web;
pub mod wire;
