/**
 * Instantiates the WebAssembly compiler synchronously, for hosts without the native addon.
 * @module
 */

/** Operations the WebAssembly module runs on UTF-8 JSON input. */
export type Instance = {
  /** Runs a named operation and returns its UTF-8 JSON result. */
  readonly call: (operation: string, input: string) => string
}

type Exports = {
  readonly memory: WebAssembly.Memory
  readonly zyzz_alloc: (length: number) => number
  readonly zyzz_call: (
    operation: number,
    operationLength: number,
    input: number,
    inputLength: number,
  ) => bigint
  readonly zyzz_free: (pointer: number, length: number) => void
}

/** Thrown when the module traps, with the panic message it printed. */
export class TrapError extends Error {
  /** Stable namespaced error identifier. */
  override name = 'Wasm.TrapError'
}

/**
 * Instantiates the module without awaiting, so synchronous APIs can call it. Bytes compile
 * synchronously first. Hosts that forbid runtime compilation, such as Cloudflare Workers, pass
 * a compiled module instead. A trap leaves Rust state undefined, so the next call starts a
 * fresh instance.
 * @param source - The `crates/wasm` module, compiled or as bytes.
 * @returns The instance's operations.
 */
export function instantiate(
  source: BufferSource | WebAssembly.Module,
): Instance {
  const module =
    source instanceof WebAssembly.Module
      ? source
      : new WebAssembly.Module(source)
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let exports: Exports | undefined
  let stderr = ''

  function start(): Exports {
    stderr = ''
    // The reactor reads no files, clock, or environment. Parser dependencies seed internal hash
    // tables with entropy, but emitted class identities use the compiler's deterministic hashes.
    const wasi = {
      environ_get: () => 0,
      environ_sizes_get: (count: number, size: number) => {
        const view = new DataView(exports!.memory.buffer)
        view.setUint32(count, 0, true)
        view.setUint32(size, 0, true)
        return 0
      },
      fd_write: (_: number, iovs: number, length: number, written: number) => {
        const memory = exports!.memory.buffer
        const view = new DataView(memory)
        let total = 0
        for (let index = 0; index < length; index++) {
          const pointer = view.getUint32(iovs + index * 8, true)
          const size = view.getUint32(iovs + index * 8 + 4, true)
          stderr += decoder.decode(new Uint8Array(memory, pointer, size))
          total += size
        }
        view.setUint32(written, total, true)
        return 0
      },
      proc_exit: (code: number) => {
        throw new TrapError(`WebAssembly compiler exited with code ${code}.`)
      },
      random_get: (pointer: number, length: number) => {
        const bytes = new Uint8Array(exports!.memory.buffer, pointer, length)
        // Web Crypto limits each request to 65,536 bytes.
        for (let offset = 0; offset < length; offset += 65536)
          crypto.getRandomValues(bytes.subarray(offset, offset + 65536))
        return 0
      },
    }
    const instance = new WebAssembly.Instance(module, {
      wasi_snapshot_preview1: wasi,
    })
    return instance.exports as unknown as Exports
  }

  function write(target: Exports, text: string): readonly [number, number] {
    const bytes = encoder.encode(text)
    const pointer = target.zyzz_alloc(bytes.length)
    new Uint8Array(target.memory.buffer, pointer, bytes.length).set(bytes)
    return [pointer, bytes.length]
  }

  return {
    call(operation, input) {
      const target = (exports ??= start())
      try {
        const [operationPointer, operationLength] = write(target, operation)
        const [inputPointer, inputLength] = write(target, input)
        const packed = target.zyzz_call(
          operationPointer,
          operationLength,
          inputPointer,
          inputLength,
        )
        const pointer = Number(packed >> 32n)
        const length = Number(packed & 0xffffffffn)
        const output = decoder.decode(
          new Uint8Array(target.memory.buffer, pointer, length),
        )
        target.zyzz_free(pointer, length)
        return output
      } catch (error) {
        exports = undefined
        if (error instanceof WebAssembly.RuntimeError)
          throw new TrapError(stderr.trim() || error.message, { cause: error })
        throw error
      }
    },
  }
}
