/** Loads the canonical reset stylesheet for web bundler adapters. @module */
import * as Fs from 'node:fs'

/** Reads the packaged stylesheet without adding a dependency on browser CSS loaders. */
export function read(): string {
  return Fs.readFileSync(new URL('../reset.css', import.meta.url), 'utf8')
}
