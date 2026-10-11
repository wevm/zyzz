//! Node-API adapter that exposes the Zyzz compiler to JavaScript hosts.
//!
//! Each export converts JavaScript inputs, calls one compiler function, and converts its result.

#[cfg(not(any(target_env = "musl", target_family = "wasm")))]
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

use napi_derive::napi;

/// Reports the compiler crate version, which also checks that the binding loads.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}
