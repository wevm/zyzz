/** Normalizes shared variable data into compiler-owned token contracts. @module */
import * as Query from './Query.js'
import * as Typography from './Typography.js'
import * as Condition from './Condition.js'
import * as Identity from './Identity.js'
import * as Literal from './Literal.js'
import * as Token from './Token.js'
import * as Theme from './Theme.js'
import * as Vars from '../Vars.js'

/** Wraps a variable set for the shared style/compiler contract. */
export function theme(
  variables: Vars.Definition,
  mappings?: Vars.Mappings | false,
): Theme.Definition {
  const original = Theme.define({})
  const metadata = variables[Token.definition]
  if (!metadata?.contract.variableSet)
    throw new Vars.InvalidError([], 'Expected a variable set.')
  const contract = Object.freeze({
    ...metadata.contract,
    ...(mappings !== undefined ? { mappings } : {}),
  })
  const tokens = from({
    ...metadata,
    contract,
    values: rebind(metadata, contract),
  })
  const definition = Object.create(null)
  Object.defineProperties(definition, {
    ...Object.getOwnPropertyDescriptors(original),
    className: {
      get: () => {
        const identity = metadata.contract[Token.identity]
        return identity
          ? `z-theme-${identity.startsWith('id-') ? identity.slice(3) : Identity.name(identity)}`
          : original.className
      },
      enumerable: true,
    },
    tokens: { value: tokens, enumerable: true },
    vars: { value: tokens, enumerable: true },
    [Token.definition]: { value: tokens[Token.definition] },
  })
  return Object.freeze(definition) as Theme.Definition
}

/** Rebuilds a reference tree from normalized compiler metadata. */
export function from(metadata: Token.Metadata): Vars.Definition {
  return buildTree(
    metadata.values,
    metadata.contract,
    metadata.queries,
    metadata.paths,
  ) as Vars.Definition
}

/**
 * Validates and freezes a complete set, or grows a base set with compatible
 * overrides and new leaves.
 */
export function build(
  input: unknown,
  contract: Token.Contract,
  options: build.Options = {},
): Vars.Definition {
  const base = options.base
  const values: Record<string, Token.Value> = Object.assign(
    Object.create(null),
    base?.values,
  )
  const paths = { ...base?.paths }
  // Segment keys keep dotted typography conditions distinct from nested paths.
  const leaves = new Set<string>()
  const categories = new Set<string>()
  for (const path of Object.keys(base?.values ?? {})) {
    const parts = base!.paths?.[path] ?? path.split('.')
    leaves.add(JSON.stringify(parts))
    for (let index = 1; index < parts.length; index++)
      categories.add(JSON.stringify(parts.slice(0, index)))
  }
  const conditions: string[][] = []
  const active = new Set<object>()
  function visit(input: unknown, path: string[]) {
    if (
      typeof input === 'string' ||
      typeof input === 'number' ||
      Token.is(input) ||
      Token.isExpression(input) ||
      (path.length > 0 &&
        input &&
        typeof input === 'object' &&
        ('default' in input ||
          ('light' in input && 'dark' in input) ||
          (Object.keys(input).length <= 2 &&
            ('light' in input || 'dark' in input))))
    ) {
      if (!path.length)
        throw new Vars.InvalidError(path, 'Expected a variable record.')
      if (categories.has(JSON.stringify(path)))
        throw new Vars.InvalidError(
          path,
          'Extensions cannot replace a variable category with a leaf.',
        )
      const name = path.join('.')
      const previous =
        base && Object.hasOwn(base.values, name) ? base.values[name] : undefined
      if (previous !== undefined && options.derived)
        throw new Vars.InvalidError(
          path,
          'Derived variables cannot replace existing paths.',
        )
      // Restating the base reference would make the variable reference itself.
      if (
        previous !== undefined &&
        Token.is(input) &&
        input.path === name &&
        (input.contract === contract ||
          (contract[Token.identity] !== undefined &&
            input.contract[Token.identity] === contract[Token.identity]))
      )
        return
      const value = read(input, path, queryData)
      if (previous !== undefined && domain(previous) !== domain(value))
        throw new Vars.InvalidError(
          path,
          'Variable overrides must preserve their domain.',
        )
      if (path.some((part) => Typography.condition(part)))
        paths[name] = Object.freeze([...path])
      values[name] = value
      return
    }
    if (leaves.has(JSON.stringify(path)))
      throw new Vars.InvalidError(
        path,
        'Extensions cannot replace a variable leaf with a category.',
      )
    const entries = record(input, path)
    if (active.has(input as object))
      throw new Vars.InvalidError(path, 'Cyclic variables are not supported.')
    active.add(input as object)
    if (
      !entries.length &&
      (!base || (path.length > 0 && !categories.has(JSON.stringify(path))))
    )
      throw new Vars.InvalidError(path, 'Variable records cannot be empty.')
    for (const [key, value] of entries) {
      const query = path[0] === 'typography' && Typography.condition(key)
      if (query) conditions.push([...path, key])
      if (!query && (!key || /[.!]/.test(key) || key.startsWith('@')))
        throw new Vars.InvalidError(
          [...path, key],
          'Expected a nonempty variable key without dots or conditions.',
        )
      visit(value, [...path, key])
    }
    active.delete(input as object)
  }
  const fields = Object.fromEntries(record(input, []))
  const queries = { ...base?.queries }
  for (const key of ['breakpoint', 'container', 'containerNames'] as const) {
    if (Object.hasOwn(fields, key)) {
      const value = fields[key]
      if (base) {
        if (key === 'containerNames') {
          if (
            !Array.isArray(value) ||
            (base.queries?.containerNames ?? []).some(
              (name) => !value.includes(name),
            )
          )
            throw new Vars.InvalidError(
              [key],
              'Extensions cannot remove container identities.',
            )
        } else record(value, [key])
      }
      Object.assign(queries, {
        [key]:
          key === 'containerNames'
            ? value
            : { ...base?.queries?.[key], ...value },
      })
      if (key !== 'container' || Object.keys(value as object).length === 0)
        delete fields[key]
    }
  }
  const queryData = Theme.define(queries as Theme.Tokens)[Token.definition]
    .queries
  if (Object.keys(fields).length) visit(fields, [])
  for (const path of conditions) {
    try {
      Condition.normalize(
        Query.resolve(
          path.at(-1)!,
          queryData ?? { breakpoint: {}, container: {}, containerNames: [] },
        ),
      )
    } catch (error) {
      throw new Vars.InvalidError(path, (error as Error).message)
    }
  }
  return buildTree(
    Object.freeze(values),
    contract,
    queryData,
    Object.keys(paths).length ? Object.freeze(paths) : undefined,
  ) as Vars.Definition
}

/** Set construction inputs. */
export declare namespace build {
  /** Base set metadata and how its existing paths may change. */
  type Options = {
    /** Set whose leaves the input overrides or extends. */
    readonly base?:
      | Pick<Token.Metadata, 'paths' | 'queries' | 'values'>
      | undefined
    /** Rejects existing paths, as derived leaves only add to the set. */
    readonly derived?: boolean | undefined
  }
}

/**
 * Reads a set's references as values for a named extension. Typography presets
 * keep their base values, since presets expand at each use.
 */
export function references(
  variables: object,
  metadata: Pick<Token.Metadata, 'paths' | 'queries' | 'values'>,
): Vars.Values {
  const tree: Record<string, unknown> = Object.create(null)

  for (const [path, value] of Object.entries(metadata.values)) {
    const parts = metadata.paths?.[path] ?? path.split('.')
    let target = tree
    let source: unknown = variables

    for (const part of parts.slice(0, -1)) {
      target = (target[part] ??= Object.create(null)) as Record<string, unknown>
      source = (source as Record<string, unknown>)[part]
    }

    const name = parts.at(-1)!
    target[name] =
      parts[0] === 'typography'
        ? value
        : (source as Record<string, unknown>)[name]
  }

  for (const key of ['breakpoint', 'container'] as const)
    if (Object.keys(metadata.queries?.[key] ?? {}).length)
      tree[key] = metadata.queries![key]
  if (metadata.queries?.containerNames?.length)
    tree.containerNames = metadata.queries.containerNames

  return tree as Vars.Values
}

function buildTree(
  values: Token.Metadata['values'],
  contract: Token.Contract,
  queries?: Query.Metadata,
  paths?: Token.Metadata['paths'],
) {
  values = rebind({ contract, values }, contract)

  type Tree = { [key: string]: Tree | Token.Reference }
  const tree: Tree = Object.create(null)
  for (const [path, value] of Object.entries(values)) {
    const parts = paths?.[path] ?? path.split('.')
    let target = tree
    for (const key of parts.slice(0, -1))
      target = (target[key] ??= Object.create(null)) as Tree
    target[parts.at(-1)!] = Token.create({
      contract,
      group: domain(value),
      path,
      value,
    })
  }
  function freeze(tree: Tree) {
    for (const value of Object.values(tree)) if (!Token.is(value)) freeze(value)
    Object.freeze(tree)
  }
  Object.defineProperty(tree, Token.definition, {
    value: Object.freeze({
      contract,
      values,
      queries,
      ...(paths ? { paths } : {}),
    }),
  })
  freeze(tree)
  return tree
}

function record(input: unknown, path: string[]) {
  if (
    !input ||
    typeof input !== 'object' ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(input))
  )
    throw new Vars.InvalidError(path, 'Expected a plain variable record.')
  return Reflect.ownKeys(input).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!
    if (
      typeof key !== 'string' ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    )
      throw new Vars.InvalidError(
        path,
        'Vars require enumerable data properties.',
      )
    return [key, descriptor.value] as const
  })
}

function read(
  input: unknown,
  path: string[],
  queries: Query.Metadata | undefined,
  active = new Set<object>(),
): Token.Value {
  if (Token.is(input)) return input
  if (Token.isExpression(input)) {
    if (
      !('group' in input) ||
      (input.group !== 'color' && input.group !== 'spacing')
    )
      throw new Vars.InvalidError(path, 'Expected a composed variable value.')
    return Vars.compose(
      input.group,
      input.parts as readonly (string | Token.Reference)[],
    )
  }
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string' && input.trim() && !/[;{}]/.test(input))
    return input
  if (active.has(input as object))
    throw new Vars.InvalidError(path, 'Cyclic variables are not supported.')
  const next = new Set(active).add(input as object)
  const entries = record(input, path)
  const fields = Object.fromEntries(entries)
  if (Object.hasOwn(fields, 'default')) {
    for (const [key] of entries)
      if (key !== 'default' && (!/^@media\s+\S/.test(key) || /[;{}]/.test(key)))
        throw new Vars.InvalidError(
          [...path, key],
          'Expected an @media condition.',
        )
    const result = Object.fromEntries(
      entries.map(([key, value]) => {
        let condition = key
        try {
          if (key !== 'default')
            condition = Condition.normalize(
              Query.resolve(
                key,
                queries ?? {
                  breakpoint: {},
                  container: {},
                  containerNames: [],
                },
              ),
            )
        } catch (error) {
          throw new Vars.InvalidError([...path, key], (error as Error).message)
        }
        return [condition, read(value, [...path, key], queries, next)]
      }),
    ) as Token.Conditions
    const expected = domain(result.default)
    if (Object.values(result).some((value) => domain(value) !== expected))
      throw new Vars.InvalidError(
        path,
        'Conditional values must share one domain.',
      )
    return Object.freeze(result)
  }
  if (
    entries.length === 2 &&
    Object.hasOwn(fields, 'light') &&
    Object.hasOwn(fields, 'dark')
  ) {
    const light = read(fields.light, [...path, 'light'], queries, next)
    const dark = read(fields.dark, [...path, 'dark'], queries, next)
    if (domain(light) !== 'color' || domain(dark) !== 'color')
      throw new Vars.InvalidError(path, 'Color schemes require colors.')
    return Object.freeze({ light, dark })
  }
  throw new Vars.InvalidError(
    path,
    'Expected a scalar, a complete color pair, or media overrides with a default.',
  )
}

/** Infers the shared declaration domain after following defaults and references. */
export function domain(value: Token.Value): Token.Group {
  if (Token.is(value) || Token.isExpression(value)) return value.group
  if (typeof value === 'object')
    return 'default' in value ? domain(value.default) : 'color'
  if (
    typeof value === 'string' &&
    (/^(?:#|(?:color|color-mix|contrast-color|light-dark|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\()/i.test(
      value,
    ) ||
      (!/[0-9()#]/.test(value) && Literal.isLiteral('color', value)))
  )
    return 'color'
  if (
    value === 0 ||
    value === '0' ||
    (typeof value === 'string' &&
      new RegExp(
        `^[+-]?(?:[0-9]*\\.[0-9]+|[0-9]+)(?:${Literal.lengthUnits.join('|')})$`,
        'i',
      ).test(value))
  )
    return 'spacing'
  return typeof value === 'number' ? 'number' : 'string'
}

/** Copies and validates category mappings without retaining mutable caller input. */
export function mappings(input: unknown): Vars.Mappings | false | undefined {
  if (input === undefined || input === false) return input
  return Object.freeze(
    Object.fromEntries(
      record(input, ['mappings'])
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([category, value]) => {
          if (
            !category ||
            !Array.isArray(value) ||
            value.some(
              (property) =>
                typeof property !== 'string' ||
                !Object.hasOwn(Literal.rules, property),
            )
          )
            throw new Vars.InvalidError(
              ['mappings', category],
              'Expected an array of CSS property names.',
            )
          if (new Set(value).size !== value.length)
            throw new Vars.InvalidError(
              ['mappings', category],
              'Property mappings cannot contain duplicates.',
            )
          return [category, Object.freeze([...value])]
        }),
    ),
  )
}

/** Combines disjoint variable leaves without mutating either authored record. */
export function merge(
  base: unknown,
  derived: unknown,
  path: string[] = [],
): Vars.Values {
  const result: Record<string, unknown> = Object.assign(
    Object.create(null),
    Object.fromEntries(record(base, path)),
  )

  for (const [key, value] of record(derived, path)) {
    const next = [...path, key]
    if (Object.hasOwn(result, key)) {
      for (const entry of [result[key], value])
        if (
          !entry ||
          typeof entry !== 'object' ||
          Array.isArray(entry) ||
          Token.is(entry) ||
          Token.isExpression(entry) ||
          'default' in entry ||
          ('light' in entry && 'dark' in entry) ||
          (Object.keys(entry).length <= 2 &&
            ('light' in entry || 'dark' in entry))
        )
          throw new Vars.InvalidError(
            next,
            'Derived variables cannot replace existing paths.',
          )

      result[key] = merge(result[key], value, next)
    } else result[key] = value
  }

  return result as Vars.Values
}

/** Updates references within a set while retaining references to independent sets. */
export function rebind(
  metadata: Token.Metadata,
  contract: Token.Contract,
): Token.Metadata['values'] {
  const active = new Set<string>()
  const values: Record<string, Token.Value> = Object.create(null)

  function resolve(value: Token.Value): Token.Value {
    if (Token.is(value)) {
      if (
        value.contract !== metadata.contract &&
        (metadata.contract[Token.identity] === undefined ||
          value.contract[Token.identity] !== metadata.contract[Token.identity])
      )
        return value

      return Token.create({
        contract,
        group: value.group,
        path: value.path,
        value: visit(value.path),
      })
    }
    if (Token.isExpression(value))
      return Vars.compose(
        value.group,
        value.parts.map((part) => {
          if (typeof part === 'string') return part
          const reference = resolve(part)
          if (!Token.is(reference))
            throw new Vars.InvalidError([], 'Expected a variable reference.')
          return reference
        }),
      )
    if (typeof value !== 'object') return value

    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, resolve(entry)]),
      ),
    ) as Token.Value
  }

  function visit(path: string): Token.Value {
    if (Object.hasOwn(values, path)) return values[path]!
    if (active.has(path))
      throw new Vars.InvalidError(
        path.split('.'),
        'Cyclic variables are not supported.',
      )
    if (!Object.hasOwn(metadata.values, path))
      throw new Vars.InvalidError(
        path.split('.'),
        'Referenced variable path is missing.',
      )

    active.add(path)
    values[path] = resolve(metadata.values[path]!)
    active.delete(path)
    return values[path]!
  }

  for (const path of Object.keys(metadata.values)) visit(path)
  return Object.freeze(
    Object.fromEntries(
      Object.keys(metadata.values).map((path) => [path, values[path]!]),
    ),
  )
}
