/**
 * Declares the generated WebAssembly compiler module for type checks that run before a build.
 * `scripts/build-wasm.ts` writes `Wasm.generated.ts`, which `#wasm` resolves to when present.
 * @module
 */
declare module '#wasm' {
  /** The `zyzz_wasm` web build, base64 encoded. */
  export const base64: string
}
