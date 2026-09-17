/** Keeps Metro's transform cache and delta graph aligned with imported authoring. @module */
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import type { EventEmitter } from 'node:events'
import * as Graph from './Graph.js'

type Options = {
  readonly platform?: string
  readonly customTransformOptions?: Readonly<Record<string, unknown>>
}
type Bundler = {
  getDependencyGraph(): Promise<{ getWatcher(): EventEmitter }>
  transformFile(
    filename: string,
    options: Options,
    buffer?: Buffer,
  ): Promise<unknown>
}
/** Metro server methods used by its own serializers and development middleware. */
export type Server = { getBundler(): { getBundler(): Bundler } }
type Changes = {
  rootDir: string
  changes: {
    addedFiles: Iterable<readonly [string, unknown]>
    modifiedFiles: Iterable<readonly [string, unknown]>
    removedFiles: Iterable<readonly [string, unknown]>
  }
}

/** Includes imported source contents in transform keys and invalidates their consumers on edits. */
export async function attach(server: Server, root: string) {
  const bundler = server.getBundler().getBundler()
  const graph = await bundler.getDependencyGraph()
  const dependencies = new Map<string, Map<string, Set<string>>>()
  const transform = bundler.transformFile.bind(bundler)
  bundler.transformFile = (filename, options, buffer) => {
    if (
      (options.platform !== 'ios' && options.platform !== 'android') ||
      !/\.[cm]?[jt]sx?$/.test(filename) ||
      Path.relative(root, filename).startsWith(`..${Path.sep}`) ||
      filename.split(Path.sep).includes('node_modules')
    )
      return transform(filename, options, buffer)
    const source = buffer?.toString('utf8') ?? Fs.readFileSync(filename, 'utf8')
    const input = Graph.read(filename, source, options.platform, root)
    const platforms =
      dependencies.get(filename) ?? new Map<string, Set<string>>()
    platforms.set(options.platform, new Set(input.files))
    dependencies.set(filename, platforms)
    const hash = Crypto.hash('sha256', JSON.stringify(input))
    return transform(
      filename,
      {
        ...options,
        customTransformOptions: {
          ...options.customTransformOptions,
          zyzzGraph: hash,
        },
      },
      buffer,
    )
  }
  graph.getWatcher().prependListener('change', (event: Changes) => {
    const entries = [
      ...event.changes.addedFiles,
      ...event.changes.modifiedFiles,
      ...event.changes.removedFiles,
    ]
    const changed = new Set(
      entries.map(([path]) => Path.join(event.rootDir, path)),
    )
    const modified = new Map(event.changes.modifiedFiles)
    const metadata = { isSymlink: false, modifiedTime: Date.now() }
    for (const [filename, imports] of dependencies) {
      if (
        changed.has(filename) ||
        ![...imports.values()].some((paths) =>
          [...paths].some((path) => changed.has(path)),
        ) ||
        !Fs.existsSync(filename)
      )
        continue
      modified.set(Path.relative(event.rootDir, filename), metadata)
    }
    event.changes = { ...event.changes, modifiedFiles: modified }
  })
}
