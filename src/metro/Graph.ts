/** Reads resolved source and packed native authoring without evaluating modules. @module */
import type * as Ast from '@oxc-project/types'
import type * as Compiler from '../compiler/Graph.js'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Snapshot from '../node/internal/Snapshot.js'

/** Source resolution supplied by Metro's live dependency graph. */
export type Resolver = (
  filename: string,
  specifier: string,
) => string | undefined

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
): Input | undefined {
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
        !['dependencies', 'devDependencies', 'peerDependencies'].some((key) => {
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
      if (
        !name ||
        name.startsWith('zyzz/') ||
        (!name.startsWith('.') && !node.type.startsWith('Export'))
      )
        continue
      const next = target(filename, name)
      if (next && /\.[cm]?[jt]sx?$/.test(next) && authoring(next, seen)) {
        authored.add(filename)
        return true
      }
    }
    return false
  }
  function visit(filename: string, source: string) {
    files.add(filename)
    const id = identity(filename)
    if (Object.hasOwn(modules, id)) return
    modules[id] = source
    const resolved: Record<string, string | null> = Object.create(null)
    imports[id] = resolved
    for (const statement of snapshot.parse({ moduleId: id, source }).program
      .body) {
      const name = specifier(statement)
      if (!name) continue
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
        continue
      }
      if (!name.startsWith('.') && !authoring(next)) continue
      resolved[name] = identity(next)
      visit(next, snapshot.readSync(next))
    }
  }
  if (
    (filename.split(Path.sep).includes('node_modules') ||
      Path.relative(root, filename).startsWith(`..${Path.sep}`)) &&
    !authoring(filename)
  )
    return undefined

  visit(filename, source)

  return {
    contracts,
    files: [...files],
    imports,
    moduleId: identity(filename),
    modules,
  }
}
