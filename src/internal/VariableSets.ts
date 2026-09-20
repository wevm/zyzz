/** Normalizes shared variable data into compiler-owned token contracts. @module */
import type * as Query from './Query.js'
import * as Condition from './Condition.js'
import * as Identity from './Identity.js'
import * as Literal from './Literal.js'
import * as Token from './Token.js'
import * as Theme from './Theme.js'
import * as Vars from '../Vars.js'

/** Wraps a variable set for the shared style/compiler contract. */
export function theme(
  variables: Vars.Definition,
  mappings?: Vars.Mappings,
): Theme.Definition {
  const original = Theme.define({})
  const metadata = variables[Token.definition]
  if (!metadata?.contract.variableSet)
    throw new Vars.InvalidError([], 'Expected a variable set.')
  const contract = Object.freeze({
    ...metadata.contract,
    ...(mappings ? { mappings } : {}),
  })
  const definition = Object.create(null)
  Object.defineProperties(definition, {
    ...Object.getOwnPropertyDescriptors(original),
    className: {
      get: () => {
        const identity = metadata.contract[Token.identity]
        return identity
          ? `z_theme-${identity}-${Identity.hash(JSON.stringify(metadata.values))}`
          : original.className
      },
      enumerable: true,
    },
    tokens: { value: variables, enumerable: true },
    vars: { value: variables, enumerable: true },
    [Token.definition]: { value: Object.freeze({ ...metadata, contract }) },
  })
  return Object.freeze(definition) as Theme.Definition
}

/** Rebuilds a reference tree from normalized compiler metadata. */
export function from(metadata: Token.Metadata): Vars.Definition {
  return buildTree(
    metadata.values,
    metadata.contract,
    metadata.queries,
  ) as Vars.Definition
}

/** Validates and freezes a complete set or compatible partial override. */
export function build(
  input: unknown,
  contract: Token.Contract,
  base?: Token.Metadata['values'],
  baseQueries?: Query.Metadata,
): Vars.Definition {
  const values: Record<string, Token.Value> = Object.assign(
    Object.create(null),
    base,
  )
  const active = new Set<object>()
  function visit(input: unknown, path: string[]) {
    if (
      typeof input === 'string' ||
      typeof input === 'number' ||
      Token.is(input) ||
      (input &&
        typeof input === 'object' &&
        ('default' in input ||
          ('light' in input && 'dark' in input) ||
          (Object.keys(input).length <= 2 &&
            ('light' in input || 'dark' in input))))
    ) {
      if (!path.length)
        throw new Vars.InvalidError(path, 'Expected a variable record.')
      const value = read(input, path)
      const name = path.join('.')
      if (base && !Object.hasOwn(base, name))
        throw new Vars.InvalidError(
          path,
          'Extensions cannot add variable paths.',
        )
      if (base && domain(base[name]!) !== domain(value))
        throw new Vars.InvalidError(
          path,
          'Variable overrides must preserve their domain.',
        )
      values[name] = value
      return
    }
    const entries = record(input, path)
    if (active.has(input as object))
      throw new Vars.InvalidError(path, 'Cyclic variables are not supported.')
    active.add(input as object)
    if (!entries.length && !base)
      throw new Vars.InvalidError(path, 'Variable records cannot be empty.')
    for (const [key, value] of entries) {
      if (!key || /[.!]/.test(key) || key.startsWith('@'))
        throw new Vars.InvalidError(
          [...path, key],
          'Expected a nonempty variable key without dots or conditions.',
        )
      visit(value, [...path, key])
    }
    active.delete(input as object)
  }
  const fields = Object.fromEntries(record(input, []))
  const queries = { ...baseQueries }
  for (const key of ['breakpoints', 'containers', 'containerNames'] as const) {
    if (Object.hasOwn(fields, key)) {
      const value = fields[key]
      Object.assign(queries, {
        [key]:
          key === 'containerNames'
            ? value
            : { ...baseQueries?.[key], ...value },
      })
      delete fields[key]
    }
  }
  const queryData = Theme.define(queries as Theme.Tokens)[Token.definition]
    .queries
  if (Object.keys(fields).length) visit(fields, [])
  return buildTree(
    Object.freeze(values),
    contract,
    queryData,
  ) as Vars.Definition
}

function buildTree(
  values: Token.Metadata['values'],
  contract: Token.Contract,
  queries?: Query.Metadata,
) {
  type Tree = { [key: string]: Tree | Token.Reference }
  const tree: Tree = Object.create(null)
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split('.')
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
    value: Object.freeze({ contract, values, queries }),
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
  active = new Set<object>(),
): Token.Value {
  if (Token.is(input)) return input
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
          if (key !== 'default') condition = Condition.normalize(key)
        } catch (error) {
          throw new Vars.InvalidError([...path, key], (error as Error).message)
        }
        return [condition, read(value, [...path, key], next)]
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
    const light = read(fields.light, [...path, 'light'], next)
    const dark = read(fields.dark, [...path, 'dark'], next)
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
  if (Token.is(value)) return value.group
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
export function mappings(input: unknown): Vars.Mappings | undefined {
  if (input === undefined) return undefined
  return Object.freeze(
    Object.fromEntries(
      record(input, ['mappings']).map(([category, value]) => {
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
