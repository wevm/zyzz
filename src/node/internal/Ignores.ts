/** Matches paths against `.gitignore` rules, so project discovery skips what Git ignores. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'

/** One `.gitignore` pattern, anchored at the directory holding its file. */
export type Rule = {
  /** Directory holding the `.gitignore` file, with platform separators. */
  readonly base: string
  /** Matches directories only, as a trailing slash requires. */
  readonly directory: boolean
  /** Re-includes a path that an earlier rule ignored. */
  readonly negated: boolean
  /** Compiled pattern over the `/`-separated path relative to `base`. */
  readonly pattern: RegExp
}

/**
 * Creates a reader of the `.gitignore` files that apply below source directories. Rules apply from
 * the enclosing repository root down, or from the source directory outside a repository. Files are
 * read synchronously once per directory, as watcher events need an immediate answer.
 * @param options - The source directories discovery walks.
 */
export function create(options: create.Options) {
  const directories = new Map<string, boolean>()
  const repositories = new Map<string, boolean>()
  const rules = new Map<string, readonly Rule[]>()

  function repository(directory: string): boolean {
    let value = repositories.get(directory)

    if (value === undefined) {
      const parent = Path.dirname(directory)

      value =
        Fs.existsSync(Path.join(directory, '.git')) ||
        (parent !== directory && repository(parent))
      repositories.set(directory, value)
    }

    return value
  }

  function read(directory: string): readonly Rule[] {
    let value = rules.get(directory)

    if (value === undefined) {
      const parent = Path.dirname(directory)
      const inherited =
        parent === directory ||
        Fs.existsSync(Path.join(directory, '.git')) ||
        (options.roots.includes(directory) && !repository(parent))
          ? []
          : read(parent)
      const source = (() => {
        try {
          return Fs.readFileSync(Path.join(directory, '.gitignore'), 'utf8')
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code

          if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR')
            return ''
          throw error
        }
      })()

      value = [...inherited, ...parse({ base: directory, source })]
      rules.set(directory, value)
    }

    return value
  }

  return {
    /**
     * Whether the rules of a path's directory ignore it. Callers check each ancestor below a
     * source directory, since Git never re-includes a path below an ignored directory.
     */
    ignored(path: ignored.Options): boolean {
      if (!path.directory) return ignored(read(Path.dirname(path.path)), path)

      let value = directories.get(path.path)

      if (value === undefined) {
        value = ignored(read(Path.dirname(path.path)), path)
        directories.set(path.path, value)
      }

      return value
    },
  }
}

/** Ignore reader contracts. */
export declare namespace create {
  /** Directories whose own `.gitignore` starts the rules outside a repository. */
  type Options = {
    /** Absolute source directories. */
    readonly roots: readonly string[]
  }
}

/**
 * Whether the last rule matching a path ignores it, as Git decides within one directory. A path
 * below an ignored directory is the caller's concern: Git never re-includes it.
 * @param rules - Rules of every `.gitignore` file that applies, outermost first.
 * @param options - Absolute path and whether it names a directory.
 */
export function ignored(
  rules: readonly Rule[],
  options: ignored.Options,
): boolean {
  let value = false

  for (const rule of rules) {
    if (rule.directory && !options.directory) continue

    const relative = relativePath(rule.base, options.path)

    if (relative !== undefined && rule.pattern.test(relative))
      value = !rule.negated
  }

  return value
}

/** Path matching contracts. */
export declare namespace ignored {
  /** The path to test. */
  type Options = {
    /** Whether the path is a directory. */
    readonly directory: boolean
    /** Absolute path with platform separators. */
    readonly path: string
  }
}

/**
 * Parses a `.gitignore` file into rules in file order. Blank lines, comments, and patterns Git
 * treats as invalid produce no rule.
 * @param options - File text and the directory holding it.
 */
export function parse(options: parse.Options): readonly Rule[] {
  const rules: Rule[] = []

  for (const line of options.source.split(/\r?\n/)) {
    // Trailing spaces are insignificant unless escaped.
    let value = line.replace(/(?<!\\)\s+$/, '')

    if (!value || value.startsWith('#')) continue

    const negated = value.startsWith('!')

    if (negated) value = value.slice(1)
    if (value.startsWith('\\#') || value.startsWith('\\!'))
      value = value.slice(1)

    const directory = value.endsWith('/')

    if (directory) value = value.slice(0, -1)
    if (!value) continue

    // A slash before the end anchors the pattern at the file's directory.
    const anchored = value.includes('/')

    if (value.startsWith('/')) value = value.slice(1)

    const source = glob(value)

    if (source === undefined) continue

    rules.push({
      base: options.base,
      directory,
      negated,
      pattern: new RegExp(anchored ? `^${source}$` : `^(?:.*/)?${source}$`),
    })
  }

  return rules
}

/** Rule parsing contracts. */
export declare namespace parse {
  /** One `.gitignore` file. */
  type Options = {
    /** Absolute directory holding the file. */
    readonly base: string
    /** File text. */
    readonly source: string
  }
}

/** Translates gitignore glob syntax to a regular expression source, or undefined when malformed. */
function glob(value: string) {
  let output = ''

  for (let index = 0; index < value.length; index++) {
    const character = value[index]!

    if (character === '*' && value[index + 1] === '*') {
      const start = index === 0 || value[index - 1] === '/'
      const end = index + 2 === value.length || value[index + 2] === '/'

      // `**` spans directories only as a whole segment; otherwise it is two single-segment stars.
      if (start && end) {
        if (index + 2 === value.length) output += '.*'
        else output += '(?:.*/)?'
        index += index + 2 === value.length ? 1 : 2
        continue
      }
    }

    if (character === '*') output += '[^/]*'
    else if (character === '?') output += '[^/]'
    else if (character === '\\') {
      const next = value[index + 1]

      if (next === undefined) return undefined

      output += escape(next)
      index++
    } else if (character === '[') {
      const close = value.indexOf(']', index + 2)

      if (close === -1) return undefined

      let body = value.slice(index + 1, close)

      if (body.startsWith('!')) body = `^${body.slice(1)}`

      output += `[${body.replace(/[\\\]]/g, '\\$&')}]`
      index = close
    } else output += escape(character)
  }

  return output
}

function escape(character: string) {
  return /[.*+?^${}()|[\]\\/]/.test(character) ? `\\${character}` : character
}

/** The `/`-separated path of `path` below `base`, or undefined outside it. */
function relativePath(base: string, path: string) {
  const relative = Path.relative(base, path)

  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${Path.sep}`) ||
    Path.isAbsolute(relative)
  )
    return undefined

  return relative.split(Path.sep).join('/')
}
