/**
 * Builds the native addon and the inlined WebAssembly compiler before integration tests, so
 * `Css.compile` runs the current Rust sources in Node and in browser bundles. Cargo skips
 * unchanged crates, so an up-to-date build costs seconds.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

const root = Path.resolve(import.meta.dirname, '..')

/**
 * Runs the package's `build:binding:test` script, which also writes the WebAssembly module. It
 * builds without link-time optimization, so test runs after a Rust edit rebuild quickly.
 */
export function setup(): void {
  const manifest = JSON.parse(
    Fs.readFileSync(Path.join(root, 'package.json'), 'utf8'),
  ) as { readonly scripts: Readonly<Record<string, string>> }

  ChildProcess.execSync(manifest.scripts['build:binding:test']!, {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${Path.join(root, 'node_modules/.bin')}${Path.delimiter}${process.env.PATH ?? ''}`,
    },
    stdio: 'inherit',
  })
}
