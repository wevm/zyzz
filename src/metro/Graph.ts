/** Reads a closed local source graph for native authoring without evaluating modules. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Parser from 'oxc-parser'
import type * as Graph from '../compiler/Graph.js'

/** Collects relative source imports; package and asset imports remain owned by Metro. */
export function read(
  filename: string,
  source: string,
  platform: string,
  root: string,
) {
  const files = new Set<string>()
  const modules: Record<string, string> = Object.create(null)
  const imports: Record<string, Record<string, string | null>> = Object.create(
    null,
  )
  function identity(filename: string) {
    const relative = Path.relative(root, filename).split(Path.sep).join('/')
    if (relative.startsWith('../'))
      throw new Error(
        `Native authoring must be inside Metro's project root: ${filename}`,
      )
    return relative
  }
  function visit(filename: string, source: string) {
    files.add(filename)
    const id = identity(filename)
    if (Object.hasOwn(modules, id)) return
    modules[id] = source
    const resolved: Record<string, string | null> = Object.create(null)
    imports[id] = resolved
    for (const statement of Parser.parseSync(filename, source).program.body) {
      if (
        !('source' in statement) ||
        !statement.source ||
        typeof statement.source !== 'object' ||
        !('value' in statement.source) ||
        typeof statement.source.value !== 'string'
      )
        continue
      const specifier = statement.source.value
      resolved[specifier] = null
      if (!specifier.startsWith('.')) continue
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
      const target = candidates.find(
        (path) => Fs.existsSync(path) && Fs.statSync(path).isFile(),
      )
      if (!target || !/\.[cm]?[jt]sx?$/.test(target)) continue
      resolved[specifier] = identity(target)
      visit(target, Fs.readFileSync(target, 'utf8'))
    }
  }
  visit(filename, source)
  return {
    moduleId: identity(filename),
    modules,
    imports,
    files: [...files],
  } satisfies Pick<Graph.compile.Options, 'modules' | 'imports'> & {
    moduleId: string
    files: readonly string[]
  }
}
