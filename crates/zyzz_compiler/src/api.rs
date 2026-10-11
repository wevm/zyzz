//! Named operations that hosts call with UTF-8 JSON input, returning UTF-8 JSON output.
//!
//! The native addon and the WebAssembly module expose this one dispatcher, so both runtimes
//! accept the same inputs and produce the same results.

/// Runs a named operation. Unknown operations return an error result rather than failing.
pub fn call(operation: &str, input: &str) -> String {
    let _ = input;

    match operation {
        "version" => crate::js::quote(env!("CARGO_PKG_VERSION")),
        _ => format!(
            "{{\"error\":{{\"name\":\"Error\",\"message\":{}}}}}",
            crate::js::quote(&format!("Unknown operation: {operation}"))
        ),
    }
}
