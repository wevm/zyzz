/**
 * Loads the Rust compiler binding for the current platform, falling back to its WebAssembly build.
 * @module
 */
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Url from 'node:url'

/** Functions the Rust binding exports. Structured values cross as JSON strings. */
export type Binding = {
  /** Version of the compiler crate, which also proves the binding loaded. */
  readonly version: () => string
}

/** Thrown when no binding loads for the current platform. */
export class LoadError extends Error {
  /** Lists every candidate and why it failed. */
  constructor(failures: readonly (readonly [string, unknown])[]) {
    super(
      `Unable to load the Zyzz compiler binding for ${process.platform}-${process.arch}. Tried:\n${failures
        .map(
          ([candidate, error]) =>
            `- ${candidate}: ${error instanceof Error ? error.message : String(error)}`,
        )
        .join('\n')}`,
    )
  }
  /** Stable namespaced error identifier. */
  override name = 'Binding.LoadError'
}

// Node caches native modules per process, so one resolved handle serves every caller.
let loaded: Binding | undefined

/**
 * Returns the binding, resolving it on first use.
 * Candidates are the repository's local build, the platform package, then the WebAssembly package.
 * @returns The binding exports.
 * @throws {LoadError} If no candidate loads.
 */
export function load(): Binding {
  loaded ??= resolve()

  return loaded
}

function resolve(): Binding {
  const require = Module.createRequire(import.meta.url)
  const directory = Path.dirname(Url.fileURLToPath(import.meta.url))
  const failures: [string, unknown][] = []

  for (const target of targets()) {
    // Source and built modules both sit two levels below the package root.
    const local = Path.resolve(directory, '../../binding', `zyzz.${target}.node`)

    for (const candidate of [local, `@zyzz/binding-${target}`]) {
      if (candidate === local && !Fs.existsSync(local)) continue

      try {
        return require(candidate) as Binding
      } catch (error) {
        failures.push([candidate, error])
      }
    }
  }

  try {
    return require('@zyzz/binding-wasm32-wasi') as Binding
  } catch (error) {
    failures.push(['@zyzz/binding-wasm32-wasi', error])
  }

  throw new LoadError(failures)
}

/** Lists the napi-rs platform suffixes this process can load, most specific first. */
function targets(): readonly string[] {
  const { arch, platform } = process

  if (platform === 'darwin') return [`darwin-${arch}`, 'darwin-universal']
  if (platform === 'win32') return [`win32-${arch}-msvc`]
  if (platform === 'linux') return [`linux-${arch}-${musl() ? 'musl' : 'gnu'}`]

  return [`${platform}-${arch}`]
}

/** Detects musl libc, whose binaries differ from glibc builds. */
function musl(): boolean {
  const report = process.report?.getReport() as
    | { header?: { glibcVersionRuntime?: string } }
    | undefined
  if (report?.header?.glibcVersionRuntime) return false

  try {
    return Fs.readFileSync('/usr/bin/ldd', 'utf8').includes('musl')
  } catch {
    return true
  }
}
