/** Runs source compilation outside the editor's main thread. @module */
import * as Compiler from './Compiler.js'
import type * as Project from './Project.js'

/** One compile request. The sequence number prevents stale edits from replacing newer output. */
export type Request = {
  /** Complete virtual project. */
  files: Project.Files
  /** Monotonically increasing edit identifier. */
  id: number
}

/** Compilation result or diagnostic for the corresponding edit. */
export type Response = {
  /** Human-readable compilation or loading failure. */
  error?: string
  /** Original edit identifier. */
  id: number
  /** Successful artifacts. */
  output?: Compiler.Output
}

let compiler: Promise<ReturnType<typeof Compiler.create>> | undefined

self.onmessage = async (event: MessageEvent<Request>) => {
  const { files, id } = event.data
  try {
    compiler ??= fetch('/playground/manifest.json').then(async (manifest) => {
      if (!manifest.ok)
        throw new Error(`Could not load compiler assets (${manifest.status}).`)
      const { wasm } = await manifest.json()
      const response = await fetch(wasm)
      if (!response.ok)
        throw new Error(`Could not load the compiler (${response.status}).`)
      return Compiler.create(await response.arrayBuffer())
    })
    const output = (await compiler).compile(files)
    self.postMessage({ id, output } satisfies Response)
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    } satisfies Response)
  }
}
