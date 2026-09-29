/** Retains unchanged source text and syntax within an adapter instance. @module */
import * as Fs from 'node:fs'
import * as Syntax from '../../compiler/internal/Syntax.js'

/** Creates a source cache; resolution and directory discovery remain owned by the host. */
export function create() {
  const files = new Map<string, { source: string; version: string }>()
  const syntax = new Map<
    string,
    { parsed: ReturnType<typeof Syntax.parse>; source: string }
  >()

  function parse(options: Syntax.parse.Options) {
    let entry = syntax.get(options.moduleId)
    if (entry?.source !== options.source) {
      entry = { parsed: Syntax.parse(options), source: options.source }
      syntax.set(options.moduleId, entry)
    }
    return entry.parsed
  }

  return {
    clear() {
      files.clear()
      syntax.clear()
    },
    delete(file: string, moduleId: string) {
      files.delete(file)
      syntax.delete(moduleId)
    },
    parse,
    programs(modules: Readonly<Record<string, string>>) {
      return new Map(
        Object.entries(modules).map(([moduleId, source]) => [
          moduleId,
          parse({ moduleId, source }),
        ]),
      )
    },
    async read(file: string) {
      try {
        const stat = await Fs.promises.stat(file, { bigint: true })
        const version = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`
        let entry = files.get(file)
        if (entry?.version !== version) {
          entry = { source: await Fs.promises.readFile(file, 'utf8'), version }
          files.set(file, entry)
        }
        return entry.source
      } catch (error) {
        files.delete(file)
        throw error
      }
    },
    readSync(file: string) {
      try {
        const stat = Fs.statSync(file, { bigint: true })
        const version = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`
        let entry = files.get(file)
        if (entry?.version !== version) {
          entry = { source: Fs.readFileSync(file, 'utf8'), version }
          files.set(file, entry)
        }
        return entry.source
      } catch (error) {
        files.delete(file)
        throw error
      }
    },
    retain(
      paths: ReadonlySet<string>,
      modules: Readonly<Record<string, string>>,
    ) {
      for (const file of files.keys()) if (!paths.has(file)) files.delete(file)
      for (const id of syntax.keys())
        if (!Object.hasOwn(modules, id)) syntax.delete(id)
    },
  }
}
