//! Data shapes and encodings of the runtime helpers that consume compiler output.
//!
//! The compiler emits these shapes as JSON literals in generated modules. Each type serializes
//! exactly as `JSON.stringify` prints the corresponding TypeScript object.

pub mod appearance;
pub mod composition;
pub mod internal;
pub mod native;
pub mod native_dynamic;
pub mod native_static;
pub mod native_vars;
pub mod recipe;
