//! Named operations that hosts call with UTF-8 JSON input, returning UTF-8 JSON output.
//!
//! The native addon and the WebAssembly module expose this one dispatcher, so both runtimes
//! accept the same inputs and produce the same results.

#[cfg(feature = "compiler")]
use crate::compiler::handles;
use crate::error::Error;
use crate::js;

/// Serializes a failure with the TypeScript error class name and its structured diagnostics.
pub fn error_json(error: &Error) -> String {
    let mut output = String::from("{\"error\":{\"name\":");

    match error {
        Error::Css(diagnostics) => {
            js::write_string(&mut output, "Css.CompileError");
            output.push_str(",\"diagnostics\":[");

            for (index, diagnostic) in diagnostics.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                output.push_str("{\"code\":");
                js::write_string(&mut output, diagnostic.code.as_str());
                output.push_str(",\"message\":");
                js::write_string(&mut output, &diagnostic.message);
                output.push_str(",\"path\":[");

                for (index, part) in diagnostic.path.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }

                    js::write_string(&mut output, part);
                }

                output.push_str("]}");
            }

            output.push(']');
        }
        #[cfg(feature = "compiler")]
        Error::Extract(extract) => {
            js::write_string(&mut output, "Source.ExtractError");
            output.push_str(",\"diagnostics\":[");

            for (index, diagnostic) in extract.diagnostics.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                output.push_str("{\"code\":");
                js::write_string(&mut output, diagnostic.code.as_str());
                output.push_str(",\"end\":");
                output.push_str(&diagnostic.end.to_string());
                output.push_str(",\"message\":");
                js::write_string(&mut output, &diagnostic.message);
                output.push_str(",\"source\":");
                js::write_string(&mut output, &diagnostic.source);
                output.push_str(",\"start\":");
                output.push_str(&diagnostic.start.to_string());
                output.push('}');
            }

            output.push(']');
        }
        Error::Conflict { source, .. } => {
            js::write_string(&mut output, "Stylesheets.ConflictError");
            output.push_str(",\"source\":");
            js::write_string(&mut output, source);
        }
        #[cfg(feature = "compiler")]
        Error::Native(_) => js::write_string(&mut output, "Native.CompileError"),
        _ => js::write_string(&mut output, "Error"),
    }

    output.push_str(",\"message\":");
    js::write_string(&mut output, &error.text());
    output.push_str("}}");
    output
}

#[cfg(feature = "compiler")]
fn json(input: &str) -> Result<serde_json::Value, Error> {
    serde_json::from_str(input).map_err(|error| Error::Message(error.to_string()))
}

/// Runs a named operation. Unknown operations return an error result rather than failing.
pub fn call(operation: &str, input: &str) -> String {
    match operation {
        #[cfg(feature = "compiler")]
        "contract.dependencies" => json(input)
            .and_then(|input| handles::dependencies(&input))
            .unwrap_or_else(|error| error_json(&error)),
        "css.compile" => crate::wire::compile(input),
        #[cfg(feature = "compiler")]
        "graph.compile" => json(input)
            .and_then(|input| handles::compile(&input))
            .unwrap_or_else(|error| error_json(&error)),
        #[cfg(feature = "compiler")]
        "source.extract" => crate::compiler::internal::wire::extract(input),
        #[cfg(feature = "compiler")]
        "transform.compile" => json(input)
            .and_then(|input| handles::transform(&input))
            .unwrap_or_else(|error| error_json(&error)),
        "version" => crate::js::quote(env!("CARGO_PKG_VERSION")),
        _ => error_json(&Error::Message(format!("Unknown operation: {operation}"))),
    }
}
