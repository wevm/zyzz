//! Node-API adapter that exposes the Zyzz compiler to JavaScript hosts.
//!
//! Every export forwards to [`zyzz_compiler::api::call`], which the WebAssembly module also
//! exposes, so both runtimes accept the same inputs and produce the same results.

#[cfg(not(any(target_env = "musl", target_family = "wasm")))]
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

use napi_derive::napi;

/// Converts a caught panic into an error result.
fn panicked(panic: &(dyn std::any::Any + Send)) -> String {
    let message = panic
        .downcast_ref::<&str>()
        .map(|message| (*message).to_owned())
        .or_else(|| panic.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "The compiler panicked.".to_owned());

    format!(
        "{{\"error\":{{\"name\":\"Error\",\"message\":{}}}}}",
        zyzz_compiler::js::quote(&message)
    )
}

/// Runs a named compiler operation on UTF-8 JSON input and returns its UTF-8 JSON result.
///
/// A panic becomes an error result, so one failing module never aborts a development server.
#[napi]
pub fn call(operation: String, input: String) -> String {
    std::panic::catch_unwind(move || zyzz_compiler::api::call(&operation, &input))
        .unwrap_or_else(|panic| panicked(&*panic))
}

/// An incremental graph compiler. Its caches live as long as this object, and garbage collection
/// releases them.
#[napi]
#[derive(Default)]
pub struct Graph {
    inner: zyzz_compiler::compiler::handles::Compiler,
}

#[napi]
impl Graph {
    /// Creates a compiler with empty caches.
    #[napi(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Compiles one JSON graph snapshot, reusing unaffected work from earlier snapshots.
    ///
    /// A panic becomes an error result and discards the caches, which may be inconsistent.
    #[napi]
    pub fn compile(&mut self, input: String) -> String {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let input = input;

            self.inner.compile(&input)
        }));

        result.unwrap_or_else(|panic| {
            self.inner = zyzz_compiler::compiler::handles::Compiler::default();
            panicked(&*panic)
        })
    }
}

/// Reports the compiler crate version, which also checks that the binding loads.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}
