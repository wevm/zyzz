/** Compiles virtual projects using the same Rust graph operation as the Node binding. @module */
import * as Wasm from '../../../src/internal/Wasm.js'
import type * as Project from './Project.js'

/** Artifacts sent to the preview and output viewers. */
export type Output = {
  /** Combined graph CSS, including shared theme resources. */
  css: string
  /** Rewritten modules. TypeScript and JSX are lowered by the preview bundler. */
  files: Project.Files
}

type Result = {
  error?: { message: string; name: string }
  modules: Record<string, { code: string; css: string }>
  shared?: { css: string }
}

/** Owns a compiler instance for one worker or integration run. */
export function create(bytes: BufferSource) {
  const engine = Wasm.instantiate(bytes)

  return {
    /** Compiles without executing source, reading files, or resolving external packages. */
    compile(files: Project.Files): Output {
      const result: Result = JSON.parse(
        engine.call('graph.compile', JSON.stringify({ modules: files })),
      )
      if (result.error)
        throw new Error(`${result.error.name}: ${result.error.message}`)

      return {
        css: [
          result.shared?.css,
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
