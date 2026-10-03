/** Converts authored variables to static native value profiles. @module */
import * as Calculation from '../../react-native/internal/Calculation.js'
import * as Literal from '../../internal/Literal.js'
import * as Media from './NativeMedia.js'
import type * as Runtime from '../../runtime/NativeVars.js'
import * as Scalar from '../../react-native/internal/Scalar.js'
import type * as Theme from '../../internal/Theme.js'
import * as Token from '../../internal/Token.js'
import * as VariableSets from '../../internal/VariableSets.js'

/** Resolves native domains using the style compiler's unit and font mappings. */
export function compile(options: compile.Options): Runtime.create.Options {
  const media = Media.prepare(undefined, options.vars, options)
  return {
    defaultVars: options.defaultVars,
    ...(media
      ? {
          media: {
            profiles: Object.fromEntries(
              media.selections.map((selection) => [
                selection,
                compile({ ...options, vars: media.select(selection).vars! })
                  .profiles,
              ]),
            ),
            queries: media.queries,
          },
        }
      : {}),
    profiles: Object.fromEntries(
      Object.entries(options.vars).map((entry) => {
        const [name, theme] = entry
        return [
          name,
          { dark: profile(theme, 'dark'), light: profile(theme, 'light') },
        ]
      }),
    ),
    unnamed: options.unnamed,
  }

  function profile(theme: Theme.Definition, scheme: 'dark' | 'light') {
    const metadata = theme[Token.definition]
    const active = new Set<Token.Reference>()
    type Tree = {
      [key: string]: string | number | Tree | readonly [string]
    }
    const tree: Tree = Object.create(null)

    function resolve(value: Token.Value): string | number {
      if (typeof value === 'string' || typeof value === 'number') return value
      if (Token.is(value)) {
        if (active.has(value))
          throw new Error('Native token aliases must not form a cycle.')
        const shared =
          metadata.contract === value.contract ||
          (metadata.contract[Token.identity] !== undefined &&
            metadata.contract[Token.identity] ===
              value.contract[Token.identity])
        const next = shared ? metadata.values[value.path] : value.value
        if (next === undefined)
          throw new Error(`Missing native token: ${value.path}.`)
        active.add(value)
        try {
          return resolve(next)
        } finally {
          active.delete(value)
        }
      }
      if (Token.isExpression(value) && 'group' in value) {
        const text = value.parts.map(resolve).join('')
        return value.group === 'spacing' && /^\s*calc\(/i.test(text)
          ? `${Calculation.length(text, options) / (options.units?.px ?? 1)}px`
          : text
      }
      if ('light' in value && 'dark' in value) return resolve(value[scheme])
      throw new Error(
        media
          ? 'Native media-conditioned variables require the native Provider window dimensions.'
          : 'Media-conditioned variables require a web target.',
      )
    }

    for (const [path, source] of Object.entries(metadata.values)) {
      const parts = metadata.paths?.[path] ?? path.split('.')
      const property = parts.at(-1)
      const domain = VariableSets.domain(source)
      const mappings = metadata.contract.mappings
      const properties = mappings === false ? undefined : mappings?.[parts[0]!]
      const category = parts[0] === 'typography' ? property! : parts[0]!
      const target = category === 'radius' ? 'borderRadius' : category
      const targets = properties?.length
        ? properties
        : Object.hasOwn(Scalar.properties, target)
          ? [target]
          : []

      const converted = (() => {
        try {
          if (parts.some((part) => /^@(media|container)\s/.test(part)))
            throw new Error('Media-conditioned variables require a web target.')
          const value = resolve(source)

          function convert(property: string): string | number {
            property =
              property in Literal.aliases
                ? Literal.aliases[property as keyof typeof Literal.aliases]
                : property
            if (!Object.hasOwn(Scalar.properties, property))
              throw new Error(`Unsupported native property: ${property}.`)

            if (property === 'lineHeight') {
              if (
                typeof value === 'string' &&
                (/^\s*calc\(/i.test(value) ||
                  /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px|rem)\s*$/i.test(
                    value,
                  ))
              )
                return Scalar.length(
                  value.trim().toLowerCase(),
                  options,
                  false,
                  [path],
                )

              const multiplier =
                typeof value === 'number' ? value : Number(value)
              if (
                !Number.isFinite(multiplier) ||
                (typeof value === 'string' && !value.trim())
              )
                throw new Error(`Unsupported native line height: ${value}.`)
              const size =
                parts[0] === 'typography'
                  ? metadata.values[
                      [...parts.slice(0, -1), 'fontSize'].join('.')
                    ]
                  : undefined
              if (size === undefined)
                throw new Error(
                  `Native line height requires fontSize: ${path}.`,
                )
              return Scalar.convert(
                'number',
                multiplier *
                  Scalar.length(resolve(size), options, false, [path]),
                options,
                [path],
              )
            }

            const kind =
              Scalar.properties[property as keyof typeof Scalar.properties]
            if (
              typeof kind === 'string' &&
              [
                'fontVariant',
                'origin',
                'shadow',
                'textShadow',
                'transform',
              ].includes(kind)
            )
              throw new Error(
                `Native property ${property} does not have a scalar variable value.`,
              )
            if (kind === 'ratio' && typeof value !== 'number')
              throw new Error(
                'Native aspect ratios require numeric variable values.',
              )
            if (kind === 'box' || kind === 'boxSigned')
              return Scalar.length(value, options, kind === 'boxSigned', [path])
            return Scalar.convert(kind, value, options, [path])
          }

          if (targets.length) {
            const values = targets.map(convert)
            if (values.some((value) => value !== values[0]))
              throw new Error(
                'Mapped native properties require different converted values.',
              )
            return values[0]!
          }
          if (domain === 'spacing')
            return Scalar.length(value, options, true, [path])
          if (domain === 'color')
            return Scalar.convert('color', value, options, [path])
          return value
        } catch (error) {
          return [
            `Native variable ${path}: ${error instanceof Error ? error.message : String(error)}`,
          ] as const
        }
      })()
      let parent = tree
      for (const key of parts.slice(0, -1))
        parent = (parent[key] ??= Object.create(null)) as typeof tree
      parent[parts.at(-1)!] = converted
    }
    return tree
  }
}

/** Compiler inputs for resolved native variables. */
export declare namespace compile {
  /** Complete variable catalog and explicit target mappings. */
  type Options = Scalar.Options & {
    /** Configuration fallback. */
    readonly defaultVars: string
    /** Whether the input is a standalone definition instead of a named catalog. */
    readonly unnamed: boolean
    /** Compatible authored definitions. */
    readonly vars: Readonly<Record<string, Theme.Definition>>
  }
}

/** Graph-owned profile exports and imports, excluded from public adapter options. */
export const shared = Symbol('zyzz.compiler.native.vars')

/** Static profile artifacts belonging to one source module. */
export type Shared = {
  readonly definitions: ReadonlyMap<string, string>
  readonly reads: ReadonlyMap<
    number,
    { readonly name: string; readonly source?: string | undefined }
  >
}
