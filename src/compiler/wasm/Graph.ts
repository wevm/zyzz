/**
 * Compiles source graphs in the WebAssembly compiler, for browsers and workers without the native
 * addon. The host loads the module, and compilation reads no files and imports no Node built-ins.
 * @module
 */
import type * as Css from '../../web/Css.js'
import * as Wasm from '../../internal/Wasm.js'
import type * as Graph from '../Graph.js'
import * as Modules from '../internal/Modules.js'
import type * as Source from '../Source.js'

/** A failure as the engine encodes it. */
type Failure = {
  readonly diagnostics?: readonly CompileError.Diagnostic[] | undefined
  readonly message: string
  readonly name: string
}

/** A web graph result as the engine encodes it. */
type Output = {
  readonly contracts: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, readonly string[]>>
  readonly modules: Readonly<Record<string, Modules.Encoded>>
  readonly shared?: Shared | undefined
}

/** Shared contributions and responsive token defaults as the engine encodes them. */
type Shared = {
  readonly assets: Readonly<Record<string, string>>
  readonly css: string
  readonly map: NonNullable<Graph.compile.ReturnType['sharedCssMap']>
  readonly owners: Readonly<Record<string, string>>
}

/** Contracts of one web graph compilation. */
export declare namespace compile {
  /** Failures the compiler reports, and a trap of the WebAssembly module. */
  type ErrorType = CompileError | Wasm.TrapError
  /** The web options of `Graph.compile` from `zyzz/compiler`. */
  type Options = Pick<
    Graph.compile.Options,
    | 'compiler'
    | 'composition'
    | 'contracts'
    | 'cssOutput'
    | 'development'
    | 'imports'
    | 'modules'
  >
  /** The output of `Graph.compile` from `zyzz/compiler` for the same options. */
  type ReturnType = Graph.compile.ReturnType
}

/**
 * A graph the compiler rejects. `failure` names the error that `Graph.compile` from
 * `zyzz/compiler` throws for the same input, and the message matches it.
 */
export class CompileError extends Error {
  /** Freezes the reported diagnostics in the compiler's reporting order. */
  constructor(options: CompileError.Options) {
    super(options.message)
    this.diagnostics = Object.freeze(
      options.diagnostics.map((item) => Object.freeze({ ...item })),
    )
    this.failure = options.failure
  }
  /** Source and CSS failures. Empty when the failure has no location, such as a missing import. */
  readonly diagnostics: readonly CompileError.Diagnostic[]
  /** Error name the native compiler reports, such as `Source.ExtractError` or `Css.CompileError`. */
  readonly failure: string
  /** Stable namespaced error identifier. */
  override name = 'Graph.CompileError'
}

/** Compile error contracts. */
export declare namespace CompileError {
  /** A source extraction or CSS compilation diagnostic. */
  type Diagnostic = Css.Diagnostic | Source.Diagnostic
  /** The failure the compiler reports. */
  type Options = {
    /** Source and CSS failures, in the compiler's reporting order. */
    readonly diagnostics: readonly Diagnostic[]
    /** Error name the native compiler reports. */
    readonly failure: string
    /** The native error's message. */
    readonly message: string
  }
}

/**
 * Instantiates the compiler from the `zyzz/compiler.wasm` module, which the host loads as an
 * asset. Each compilation is independent, as `Graph.compile` from `zyzz/compiler` is.
 * @param options - The WebAssembly module, compiled or as bytes.
 * @returns A compiler that owns one WebAssembly instance.
 */
export function create(options: create.Options): create.ReturnType {
  const engine = Wasm.instantiate(options.module)

  return Object.freeze({
    compile(options: compile.Options): compile.ReturnType {
      const output = JSON.parse(
        engine.call(
          'graph.compile',
          JSON.stringify({
            compiler: options.compiler,
            composition: options.composition,
            contracts: options.contracts,
            cssOutput: options.cssOutput,
            development: options.development,
            imports: options.imports,
            modules: options.modules,
          }),
        ),
      ) as Output & { readonly error?: Failure | undefined }

      if (output.error)
        throw new CompileError({
          diagnostics: output.error.diagnostics ?? [],
          failure: output.error.name,
          message: output.error.message,
        })

      // Keys follow the order `Graph.compile` from `zyzz/compiler` writes, so both outputs
      // serialize identically.
      return Object.freeze({
        ...(output.shared
          ? {
              sharedCss: output.shared.css,
              sharedCssMap: output.shared.map,
              sharedAssets: Object.freeze(
                Object.assign(Object.create(null), output.shared.assets),
              ),
              sharedAssetOwners: Object.freeze(
                Object.assign(Object.create(null), output.shared.owners),
              ),
            }
          : {}),
        contracts: Object.freeze({ ...output.contracts }),
        dependencies: Object.freeze(
          Object.assign(
            Object.create(null),
            Object.fromEntries(
              Object.entries(output.dependencies).map((entry) => [
                entry[0],
                Object.freeze([...entry[1]]),
              ]),
            ),
          ),
        ),
        modules: Object.freeze(
          Object.fromEntries(
            Object.entries(output.modules).map((entry) => [
              entry[0],
              Modules.decode(entry[1]),
            ]),
          ),
        ),
      }) as compile.ReturnType
    },
  })
}

/** WebAssembly compiler contracts. */
export declare namespace create {
  /** The compiler module. */
  type Options = {
    /**
     * The `zyzz/compiler.wasm` module. Bytes compile synchronously, which Cloudflare Workers
     * forbid and browsers limit on the main thread, so those hosts pass a compiled module.
     */
    readonly module: BufferSource | WebAssembly.Module
  }
  /** A compiler that owns one WebAssembly instance and its memory. */
  type ReturnType = {
    /** Compiles one complete web graph snapshot. */
    readonly compile: (options: compile.Options) => compile.ReturnType
  }
}
