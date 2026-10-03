/** Reads resolved source and packed native authoring without evaluating modules. @module */
import type * as Ast from '@oxc-project/types'
import type * as Compiler from '../compiler/Graph.js'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Snapshot from '../node/internal/Snapshot.js'

/** Serializable source snapshot delivered to a Metro transformer worker. */
export type Input = Pick<
  Compiler.compile.Options,
  'contracts' | 'imports' | 'modules'
> & {
  /** Files and sidecars whose edits invalidate this consumer. */
  readonly files: readonly string[]
  /** Portable compiler identity for the requesting module. */
  readonly moduleId: string
}

/** Collects authoring through Metro resolutions, retaining packed contracts and watched inputs. */
export function read(
  filename: string,
  source: string,
  platform: string,
  root: string,
  snapshot = Snapshot.create(),
  resolve?: Resolver,
): read.ReturnType {
  const contracts: Record<string, string> = Object.create(null)
  const files = new Set<string>()
  const imports: Record<string, Record<string, string | null>> = Object.create(
    null,
  )
  const modules: Record<string, string> = Object.create(null)

  function identity(filename: string) {
    const parts = Path.relative(root, filename).split(Path.sep)
    let parents = 0
    while (parts[0] === '..') {
      parents++
      parts.shift()
    }
    return `${parents ? `external/${parents}` : 'project'}/${parts.map(encodeURIComponent).join('/')}`
  }

  function local(filename: string): boolean {
    const relative = Path.relative(root, filename)
    return (
      relative !== '..' &&
      !relative.startsWith(`..${Path.sep}`) &&
      !Path.isAbsolute(relative) &&
      !relative.split(Path.sep).includes('node_modules')
    )
  }

  function manifest(filename: string): string | undefined {
    let directory = Path.dirname(filename)
    while (true) {
      const file = Path.join(directory, 'package.json')
      files.add(file)
      if (Fs.existsSync(file)) return file

      const parent = Path.dirname(directory)
      if (parent === directory) return undefined
      directory = parent
    }
  }

  function target(filename: string, specifier: string): string | undefined {
    if (resolve) {
      const next = resolve(filename, specifier)
      if (next && !specifier.startsWith('.')) manifest(next)
      return next
    }
    if (!specifier.startsWith('.')) return undefined
    const base = Path.resolve(Path.dirname(filename), specifier)
    const stem = base.replace(/\.[cm]?jsx?$/, '')
    const candidates = [
      ...['.ts', '.tsx', '.js', '.jsx'].flatMap((extension) => [
        `${stem}.${platform}${extension}`,
        `${stem}.native${extension}`,
        `${stem}${extension}`,
      ]),
      base,
      ...['.ts', '.tsx', '.js', '.jsx'].map((extension) =>
        Path.join(base, `index${extension}`),
      ),
    ]
    for (const candidate of candidates) files.add(candidate)
    return candidates.find(
      (path) => Fs.existsSync(path) && Fs.statSync(path).isFile(),
    )
  }

  function specifier(node: Ast.Program['body'][number]): string | undefined {
    if (
      (node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportAllDeclaration' &&
        node.type !== 'ExportNamedDeclaration') ||
      !node.source ||
      ('importKind' in node && node.importKind === 'type') ||
      ('exportKind' in node && node.exportKind === 'type') ||
      ('specifiers' in node &&
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) =>
            ('importKind' in specifier && specifier.importKind === 'type') ||
            ('exportKind' in specifier && specifier.exportKind === 'type'),
        ))
    )
      return undefined

    return node.source.value
  }

  function requires(node: unknown, names: Set<string>): void {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) requires(child, names)
      return
    }

    const entry = node as Ast.Node
    if (
      entry.type === 'CallExpression' &&
      entry.callee.type === 'Identifier' &&
      entry.callee.name === 'require' &&
      entry.arguments.length === 1
    ) {
      const argument = entry.arguments[0]!
      if (argument.type === 'Literal' && typeof argument.value === 'string')
        names.add(argument.value)
    }

    for (const child of Object.values(node)) requires(child, names)
  }

  const authored = new Set<string>()
  function authoring(filename: string, seen = new Set<string>()): boolean {
    files.add(filename)
    files.add(`${filename}.zyzz.json`)
    if (Fs.existsSync(`${filename}.zyzz.json`)) return true
    if (authored.has(filename)) return true
    if (seen.has(filename)) return false
    seen.add(filename)
    const source = snapshot.readSync(filename)
    const file = manifest(filename)
    if (file && !/['"]zyzz(?:\/default)?['"]/.test(source)) {
      const data = JSON.parse(snapshot.readSync(file)) as Record<
        string,
        unknown
      >
      if (
        ![
          'dependencies',
          'devDependencies',
          'optionalDependencies',
          'peerDependencies',
        ].some((key) => {
          const dependencies = data[key]
          return (
            dependencies &&
            typeof dependencies === 'object' &&
            Object.hasOwn(dependencies, 'zyzz')
          )
        })
      )
        return false
    }

    for (const node of snapshot.parse({ moduleId: identity(filename), source })
      .program.body) {
      const name = specifier(node)
      if (name === 'zyzz' || name === 'zyzz/default') {
        authored.add(filename)
        return true
      }
      if (!name || name.startsWith('zyzz/')) continue
      const next = target(filename, name)
      if (next && /\.[cm]?[jt]sx?$/.test(next) && authoring(next, seen)) {
        authored.add(filename)
        return true
      }
    }
    return false
  }
  const visited = new Set<string>()
  function visit(filename: string, source: string, packed = false) {
    files.add(filename)
    const id = identity(filename)
    if (visited.has(id)) return
    visited.add(id)
    if (!packed) modules[id] = source
    const resolved: Record<string, string | null> = Object.create(null)
    imports[id] = resolved
    const program = snapshot.parse({ moduleId: id, source }).program
    const names = new Set<string>()
    for (const statement of program.body) {
      const name = specifier(statement)
      if (name) names.add(name)
    }
    if (packed) requires(program, names)

    for (const name of names) {
      resolved[name] = null
      if (
        name === 'zyzz' ||
        name.startsWith('zyzz/') ||
        ['react', 'react-native'].includes(name)
      )
        continue
      const next = target(filename, name)
      if (!next || !/\.[cm]?[jt]sx?$/.test(next)) continue
      const packed = `${next}.zyzz.json`
      files.add(packed)
      if (Fs.existsSync(packed)) {
        files.add(next)
        contracts[identity(next)] = snapshot.readSync(packed)
        resolved[name] = identity(next)
        visit(next, snapshot.readSync(next), true)
        continue
      }
      if (!name.startsWith('.') && !local(next) && !authoring(next)) continue
      resolved[name] = identity(next)
      visit(next, snapshot.readSync(next))
    }
  }
  if (!local(filename) && !authoring(filename))
    return { files: [...files], input: undefined }

  visit(filename, source)

  const watched = [...files]
  return {
    files: watched,
    input: {
      contracts,
      files: watched,
      imports,
      moduleId: identity(filename),
      modules,
    },
  }
}

/** Source classification and all paths that can change its result. */
export declare namespace read {
  /** Candidate files remain watchable even when the module currently needs no compilation. */
  type ReturnType = {
    /** Sources, manifests, and sidecar candidates that affect classification. */
    readonly files: readonly string[]
    /** Compiler input when the module belongs to the authoring graph. */
    readonly input: Input | undefined
  }
}

/** Source resolution supplied by Metro's live dependency graph. */
export type Resolver = (
  filename: string,
  specifier: string,
) => string | undefined
