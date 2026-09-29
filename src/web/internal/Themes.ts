/**
 * Collects live theme references and emits graph-local variables and scope rules.
 * @module
 */
import * as Identity from '../../internal/Identity.js'
import * as Scheme from '../../internal/Scheme.js'
import * as Token from '../../internal/Token.js'
import type * as Vars from '../../Vars.js'
import type * as Theme from '../../internal/Theme.js'

/** Collects live token references within one in-memory compilation graph. */
export function create() {
  let nextScope = 0
  let nextVariable = 0
  const contracts = new Map<
    Token.Contract,
    { identity: string | undefined; paths: Map<string, string> }
  >()

  const defaults = new Map<string, readonly Rule[]>()
  const defaultGroups = new Map<Token.Contract, Set<string>>()

  function serialize(token: Token.Reference): string {
    const value = token.value
    let contract = contracts.get(token.contract)

    if (!contract) {
      contract = {
        identity: token.contract[Token.identity],
        paths: new Map(),
      }
      contracts.set(token.contract, contract)
    }

    let name = contract.paths.get(token.path)

    if (!name) {
      name =
        contract.identity === undefined
          ? `--z${nextVariable++}`
          : variable(contract.identity, token.path)
      contract.paths.set(token.path, name)
    }

    const label = contract.identity?.startsWith('src-') ? token.path : undefined
    return `var(${name},${literal(value, label, token.contract)})`
  }

  function emit(
    themes: Readonly<Record<string, Theme.Definition | Vars.Definition>>,
    schemes = false,
    separate?: 'all' | 'defaults',
  ) {
    const classes: Record<string, string> = Object.create(null)
    const completeDefaults = new Set<Token.Contract>()
    const empty: string[] = []
    const rules: Rule[] = []

    for (const [name, theme] of Object.entries(themes)) {
      if (!name) throw new Error('Theme names must be nonempty.')

      const data =
        theme &&
        (Object.getOwnPropertyDescriptor(theme, Token.definition)?.value as
          | Token.Metadata
          | undefined)
      if (!data) throw new Error('Expected a theme definition.')

      // Anonymous contracts are graph-local. Source-owned contracts retain stable
      // identities across separately compiled components and theme scopes.
      const className =
        data.contract[Token.identity] === undefined
          ? `t_${nextScope++}`
          : `z_theme-${encode(name)}`

      classes[name] = className

      let contract = contracts.get(data.contract)

      if (data.contract[Token.complete]) {
        contract ??= {
          identity: data.contract[Token.identity],
          paths: new Map(),
        }

        // Separately compiled components may reference tokens absent from this graph.
        for (const path of Object.keys(data.values)) {
          if (contract.paths.has(path)) continue

          contract.paths.set(
            path,
            contract.identity === undefined
              ? `--z${nextVariable++}`
              : variable(contract.identity, path),
          )
        }

        contracts.set(data.contract, contract)
      }

      if (!contract) continue
      // Independently compiled consumers must import identical fallback contents.
      if (separate === 'all' && contract.identity) {
        completeDefaults.add(data.contract)
        for (const [path, value] of Object.entries(data.values))
          literal(
            value,
            contract.identity.startsWith('src-') ? path : undefined,
            data.contract,
          )
      }
      if (!contract.paths.size) empty.push(`.${className}{}`)

      const declarations: Rule[] = []
      // Resolving a value can add references to this contract.
      const paths = [...contract.paths]
      for (const [path, name] of paths) {
        const value = data.values[path]
        if (value === undefined)
          throw new Error('Theme scope is missing a live token.')

        const label = contract.identity?.startsWith('src-') ? path : undefined
        declarations.push({
          conditions: [],
          property: name,
          selector: `.${className}`,
          value: literal(value, label, data.contract),
        })
      }

      rules.push(...declarations)
      for (const [path, name] of contract.paths)
        conditional(
          data.values[path]!,
          name,
          `.${className}`,
          rules,
          contract.identity?.startsWith('src-') ? path : undefined,
          [],
          data.contract,
        )
    }

    const scopes = new Map<string, Rule[]>()
    for (const rule of rules) {
      const entries = scopes.get(rule.property) ?? []
      entries.push(rule)
      scopes.set(rule.property, entries)
    }

    const grouped = new Set<string>()
    const resources: Resource[] = []
    if (separate === 'all')
      for (const [contract, names] of defaultGroups) {
        if (!completeDefaults.has(contract)) continue

        // Sort independent properties only. Each property retains its authored conditional order.
        const rules = [...names].sort().flatMap((name) => defaults.get(name)!)
        resources.push({
          css: render(rules),
          id: JSON.stringify([
            contract[Token.identity],
            'fallbacks',
            Object.entries(themes)
              .filter(
                ([, theme]) => theme[Token.definition].contract === contract,
              )
              .map(([name]) => name)
              .sort(),
          ]),
          rules,
        })
        for (const name of names) grouped.add(name)
      }

    return {
      classes: Object.freeze(classes),
      css:
        separate === 'all'
          ? ''
          : [
              ...empty,
              render([
                ...(separate ? [] : [...defaults.values()].flat()),
                ...rules,
              ]),
              ...(schemes ? [Scheme.css] : []),
            ]
              .filter(Boolean)
              .join('\n'),
      resources: separate
        ? [
            ...resources,
            ...[...defaults]
              .filter(([id]) => !grouped.has(id))
              .map(([id, rules]) => ({
                css: render(rules),
                id,
                rules,
              })),
            // Keep every scope of a property together so overlapping themes retain precedence.
            ...(separate === 'all'
              ? [...scopes].map(([property, rules]) => ({
                  css: render(rules),
                  id: JSON.stringify([classes, property]),
                  rules,
                }))
              : []),
            ...(separate === 'all' && schemes
              ? [{ css: Scheme.css, id: 'zyzz-color-scheme' }]
              : []),
          ]
        : [],
    }
  }

  function literal(
    value: Token.Value,
    label?: string,
    owner?: Token.Contract,
  ): string {
    if (Token.is(value)) return serialize(value)
    if (typeof value !== 'object') return String(value)
    if ('default' in value) {
      // Separate fallback properties preserve extensions and resolve references within each scope.
      const base = literal(value.default, label, owner)
      // Rule consolidation must not change existing variable identities.
      const css = `:where(*){--fallback:${base};}${conditionalCss(value, '--fallback', ':where(*)', label, owner)}`
      const name = label
        ? `--z-${Identity.label(label)}-fallback-${Identity.compact(css)}`
        : `--z-f${Identity.hash(css)}`
      const emitted: Rule[] = [
        { conditions: [], property: name, selector: ':where(*)', value: base },
      ]
      conditional(value, name, ':where(*)', emitted, label, [], owner)
      defaults.set(name, emitted)
      if (owner) {
        const names = defaultGroups.get(owner) ?? new Set<string>()
        names.add(name)
        defaultGroups.set(owner, names)
      }
      return `var(${name})`
    }
    return `light-dark(${literal(value.light, label, owner)},${literal(value.dark, label, owner)})`
  }

  function conditionalCss(
    value: Token.Value,
    property: string,
    selector: string,
    label?: string,
    owner?: Token.Contract,
  ): string {
    if (
      !value ||
      typeof value !== 'object' ||
      Token.is(value) ||
      !('default' in value)
    )
      return ''
    return (
      conditionalCss(value.default, property, selector, label, owner) +
      Object.entries(value)
        .filter(([query]) => query !== 'default')
        .map(
          ([query, entry]) =>
            `${query}{${selector}{${property}:${literal(entry, label, owner)};}${conditionalCss(entry, property, selector, label, owner)}}`,
        )
        .join('')
    )
  }

  function conditional(
    value: Token.Value,
    name: string,
    selector: string,
    rules: Rule[],
    label?: string,
    conditions: readonly string[] = [],
    owner?: Token.Contract,
  ) {
    if (
      !value ||
      typeof value !== 'object' ||
      Token.is(value) ||
      !('default' in value)
    )
      return
    conditional(value.default, name, selector, rules, label, conditions, owner)
    for (const [query, entry] of Object.entries(value)) {
      if (query === 'default') continue
      const nested = [...conditions, query]
      rules.push({
        conditions: nested,
        property: name,
        selector,
        value: literal(entry, label, owner),
      })
      conditional(entry, name, selector, rules, label, nested, owner)
    }
  }

  return { emit, serialize }
}

/** Escapes a scope key into the identifier segment of its compiled class. */
export function encode(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )
}

/** Combines generated declarations without crossing competing declarations of the same property. */
export function render(rules: readonly Rule[]): string {
  const groups: {
    conditions: readonly string[]
    declarations: Rule[]
    selector: string
  }[] = []
  for (const rule of rules) {
    let target: (typeof groups)[number] | undefined
    for (let index = groups.length - 1; index >= 0; index--) {
      const group = groups[index]!
      if (
        group.selector === rule.selector &&
        JSON.stringify(group.conditions) === JSON.stringify(rule.conditions)
      ) {
        target = group
        break
      }
      if (group.declarations.some((entry) => entry.property === rule.property))
        break
    }
    if (!target) {
      target = {
        conditions: rule.conditions,
        declarations: [],
        selector: rule.selector,
      }
      groups.push(target)
    }
    const previous = target.declarations.findLast(
      (entry) => entry.property === rule.property,
    )
    if (previous?.value !== rule.value) target.declarations.push(rule)
  }
  return groups
    .map(({ conditions, declarations, selector }) => {
      let css = `${selector}{${declarations.map(({ property, value }) => `${property}:${value};`).join('')}}`
      for (const condition of [...conditions].reverse())
        css = `${condition}{${css}}`
      return css
    })
    .join('\n')
}

/** One generated definition whose scope order must remain intact. */
export type Resource = {
  /** Complete fallback or scoped token definition. */
  readonly css: string
  /** Stable identity for stylesheet replacement during development. */
  readonly id: string
  /** Generated declarations eligible for consolidation. */
  readonly rules?: readonly Rule[] | undefined
}

/** One generated custom-property declaration and its ordered conditional scope. */
export type Rule = {
  /** Outer-to-inner conditional rules. */
  readonly conditions: readonly string[]
  /** Generated custom-property name. */
  readonly property: string
  /** Theme or universal fallback selector. */
  readonly selector: string
  /** Serialized custom-property value. */
  readonly value: string
}

/** Selects independently shareable defaults or all token rules. */
export const shared = Symbol('shared token rules')

function variable(index: number | string, path: string): string {
  // Packed declarations retain the spelling assigned by their compiler.
  if (typeof index === 'string' && index.startsWith('src-'))
    return `--z-${Identity.label(path)}-${Identity.compact(JSON.stringify([index, path]))}`
  return `--z-t${encode(String(index))}-${encode(path)}`
}
