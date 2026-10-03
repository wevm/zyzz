/** Keeps Metro's transform cache and delta graph aligned with imported authoring. @module */
import * as AsyncHooks from 'node:async_hooks'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Snapshot from '../node/internal/Snapshot.js'
import type { EventEmitter } from 'node:events'
import * as Graph from './Graph.js'

type Options = {
  readonly customTransformOptions?: Readonly<Record<string, unknown>>
  readonly platform?: string
}
type Bundler = {
  getDependencyGraph(): Promise<{
    getWatcher(): EventEmitter
    resolveDependency(
      filename: string,
      dependency: {
        data: {
          asyncType: null
          isESMImport: boolean
          key: string
          locs: readonly never[]
        }
        name: string
      },
      platform: string,
      options: { customResolverOptions: Readonly<Record<string, unknown>> },
    ): { type: string; filePath?: string }
  }>
  transformFile(
    filename: string,
    options: Options,
    buffer?: Buffer,
  ): Promise<unknown>
}
type ResolverOptions = {
  readonly customResolverOptions: Readonly<Record<string, unknown>>
}
type IncrementalBundler = {
  buildGraphForEntries: Build
  getBundler(): Bundler
  getDependencies: Build
  updateGraph(revision: { graph: object }, reset: boolean): Promise<unknown>
}
type Build = (
  entries: readonly string[],
  transform: unknown,
  resolver: ResolverOptions,
  options?: unknown,
) => Promise<object>
/** Metro server methods used by its own serializers and development middleware. */
export type Server = { getBundler(): IncrementalBundler }
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
  const incremental = server.getBundler()
  const bundler = incremental.getBundler()
  const requests = new AsyncHooks.AsyncLocalStorage<ResolverOptions>()
  const selections = new WeakMap<object, ResolverOptions>()
  for (const name of ['buildGraphForEntries', 'getDependencies'] as const) {
    const build = incremental[name].bind(incremental)
    incremental[name] = (entries, transform, resolver, options) =>
      requests.run(resolver, async () => {
        const graph = await build(entries, transform, resolver, options)
        selections.set(graph, resolver)
        return graph
      })
  }
  const update = incremental.updateGraph.bind(incremental)
  incremental.updateGraph = (revision, reset) =>
    requests.run(
      selections.get(revision.graph) ?? { customResolverOptions: {} },
      () => update(revision, reset),
    )

  const ready = bundler.getDependencyGraph()
  const dependencies = new Map<string, Map<string, Set<string>>>()
  const snapshot = Snapshot.create()
  const transform = bundler.transformFile.bind(bundler)
  bundler.transformFile = async (filename, options, buffer) => {
    if (
      (options.platform !== 'ios' && options.platform !== 'android') ||
      !/\.[cm]?[jt]sx?$/.test(filename) ||
      filename.startsWith(
        `${Path.resolve(import.meta.dirname, '..')}${Path.sep}`,
      )
    )
      return transform(filename, options, buffer)
    const source = buffer?.toString('utf8') ?? Fs.readFileSync(filename, 'utf8')
    const graph = await ready
    const input = Graph.read(
      filename,
      source,
      options.platform,
      root,
      snapshot,
      (filename, specifier) => {
        const resolved = graph.resolveDependency(
          filename,
          {
            data: {
              asyncType: null,
              isESMImport: true,
              key: specifier,
              locs: [],
            },
            name: specifier,
          },
          options.platform!,
          requests.getStore() ?? { customResolverOptions: {} },
        )
        return resolved.type === 'sourceFile' ? resolved.filePath : undefined
      },
    )
    if (!input) return transform(filename, options, buffer)

    const platforms =
      dependencies.get(filename) ?? new Map<string, Set<string>>()
    platforms.set(
      JSON.stringify([options.platform, requests.getStore()]),
      new Set(input.files),
    )
    dependencies.set(filename, platforms)
    const hash = Crypto.hash('sha256', JSON.stringify(input))
    return transform(
      filename,
      {
        ...options,
        customTransformOptions: {
          ...options.customTransformOptions,
          zyzzGraph: hash,
          zyzzSources: input,
        },
      },
      buffer,
    )
  }
  const graph = await ready
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
