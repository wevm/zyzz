//! Node-API adapter that exposes the Zyzz compiler to JavaScript hosts.
//!
//! Every export forwards to [`zyzz_compiler::api::call`], which the WebAssembly module also
//! exposes, so both runtimes accept the same inputs and produce the same results.

#[cfg(not(any(target_env = "musl", target_family = "wasm")))]
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

use napi_derive::napi;

/// Runs a named compiler operation on UTF-8 JSON input and returns its UTF-8 JSON result.
///
/// A panic becomes an error result, so one failing module never aborts a development server.
#[napi]
pub fn call(operation: String, input: String) -> String {
    std::panic::catch_unwind(move || zyzz_compiler::api::call(&operation, &input)).unwrap_or_else(
        |panic| {
            let message = panic
                .downcast_ref::<&str>()
                .map(|message| (*message).to_owned())
                .or_else(|| panic.downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "The compiler panicked.".to_owned());

            format!(
                "{{\"error\":{{\"name\":\"Error\",\"message\":{}}}}}",
                zyzz_compiler::js::quote(&message)
            )
        },
    )
}

/// Reports the compiler crate version, which also checks that the binding loads.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}
