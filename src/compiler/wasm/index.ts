/**
 * Exposes source graph compilation in the WebAssembly compiler, for browsers and workers without
 * the native addon. The host loads the module from `zyzz/compiler.wasm`.
 * @module
 */
/** Web graph compilation in a host-loaded WebAssembly compiler. */
export * as Graph from './Graph.js'
