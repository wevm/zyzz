//! String edits and source maps with the output of the JavaScript libraries the TypeScript
//! compiler uses: `magic-string` 1.2, `@jridgewell/gen-mapping` 0.3, `@jridgewell/trace-mapping`
//! 0.3, and `@jridgewell/sourcemap-codec` 1.6.
//!
//! Edits take UTF-8 byte offsets. Generated maps count columns in UTF-16 code units, so maps of
//! non-ASCII sources match the JavaScript libraries byte for byte.

pub mod codec;
pub mod gen_mapping;
pub mod magic_string;
pub mod trace_mapping;
