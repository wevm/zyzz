/**
 * Runs compiler operations in the WebAssembly build inlined into the bundle, for browsers and
 * workers. It needs no Node built-ins, network, or asynchronous start.
 * @module
 */
import * as Module from '#wasm'
import * as Wasm from '../../internal/Wasm.js'

// Compiling the module is the expensive step, so one instance serves the realm.
let instance: Wasm.Instance | undefined

/**
 * Runs a named compiler operation on JSON input.
 * @param operation - Operation name, such as `css.compile`.
 * @param input - UTF-8 JSON input.
 * @returns UTF-8 JSON output, including encoded failures.
 */
export function call(operation: string, input: string): string {
  instance ??= Wasm.instantiate(decode(Module.base64))

  return instance.call(operation, input)
}

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Decodes without `atob`, which bare realms such as Node `vm` contexts lack.
function decode(text: string): Uint8Array<ArrayBuffer> {
  const values = new Uint8Array(128)

  for (let index = 0; index < alphabet.length; index++)
    values[alphabet.charCodeAt(index)] = index

  const padding = text.length - text.replace(/=+$/u, '').length
  const output = new Uint8Array((text.length / 4) * 3 - padding)
  let position = 0

  for (let index = 0; index < text.length; index += 4) {
    const bits =
      (values[text.charCodeAt(index)]! << 18) |
      (values[text.charCodeAt(index + 1)]! << 12) |
      (values[text.charCodeAt(index + 2)]! << 6) |
      values[text.charCodeAt(index + 3)]!

    output[position++] = bits >> 16
    if (position < output.length) output[position++] = (bits >> 8) & 255
    if (position < output.length) output[position++] = bits & 255
  }

  return output
}
