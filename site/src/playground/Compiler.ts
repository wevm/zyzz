/** Compiles virtual projects with the WebAssembly compiler that `zyzz/compiler/wasm` publishes. @module */
import type { Source } from 'zyzz/compiler'
import { Graph } from 'zyzz/compiler/wasm'
import type * as Project from './Project.js'

/** A compiler failure with any source ranges available for editor diagnostics. */
export class CompileError extends Error {
  /** Source-owned failures, with UTF-16 offsets into the authored files. */
  readonly diagnostics: readonly Diagnostic[]

  /** Namespaced error identity for playground compilation failures. */
  override name = 'Compiler.CompileError'

  /** Preserves the compiler message and structured diagnostics without parsing its text. */
  constructor(error: Graph.CompileError) {
    super(`${error.failure}: ${error.message}`)
    this.diagnostics = error.diagnostics.filter(
      (diagnostic) => 'source' in diagnostic,
    )
  }
}

/** A located error emitted by the source compiler. */
export type Diagnostic = Source.Diagnostic

/** Artifacts sent to the preview and output viewers. */
export type Output = {
  /** Combined graph CSS, including shared theme resources. */
  css: string
  /** Rewritten modules. TypeScript and JSX are lowered by the preview bundler. */
  files: Project.Files
}

/** Owns a compiler instance for one worker or integration run. */
export function create(bytes: BufferSource) {
  const compiler = Graph.create({ module: bytes })

  return {
    /** Compiles without executing source, reading files, or resolving external packages. */
    compile(files: Project.Files): Output {
      const result = (() => {
        try {
          return compiler.compile({ modules: files })
        } catch (error) {
          // The output panel names the native error, as the CLI and bundler plugins report it.
          if (error instanceof Graph.CompileError) throw new CompileError(error)
          throw error
        }
      })()

      return {
        css: [
          result.sharedCss,
          ...Object.values(result.modules).map((module) => module.css),
        ]
          .filter(Boolean)
          .join('\n'),
        files: Object.fromEntries(
          Object.entries(result.modules).map((entry) => [
            entry[0],
            entry[1].code,
          ]),
        ),
      }
    },
  }
}
