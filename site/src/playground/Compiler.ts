/** Compiles virtual projects with the WebAssembly compiler that `zyzz/compiler/wasm` publishes. @module */
import { Graph } from 'zyzz/compiler/wasm'
import type * as Project from './Project.js'

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
          if (error instanceof Graph.CompileError)
            throw new Error(`${error.failure}: ${error.message}`)
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
