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

  const defaults = new Map<string, string>()

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
    return `var(${name},${literal(value, label)})`
  }

  function emit(
    themes: Readonly<Record<string, Theme.Definition | Vars.Definition>>,
    schemes = false,
    separate?: 'all' | 'defaults',
  ) {
    const classes: Record<string, string> = Object.create(null)
    const rules: string[] = []

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

      const body = [...contract.paths]
        .map(([path, name]) => {
          const value = data.values[path]
          if (value === undefined)
            throw new Error('Theme scope is missing a live token.')

          const label = contract.identity?.startsWith('src-') ? path : undefined
          return `${name}:${literal(value, label)};`
        })
        .join('')

      rules.push(`.${className}{${body}}`)
      for (const [path, name] of contract.paths)
        conditional(
          data.values[path]!,
          name,
          `.${className}`,
          rules,
          contract.identity?.startsWith('src-') ? path : undefined,
        )
    }

    // Scheme rules travel with the module that can apply them, so lowered
    // light-dark() resolves wherever selection helpers load.
    if (schemes) rules.push(Scheme.css)

    return {
      classes: Object.freeze(classes),
      css:
        separate === 'all'
          ? ''
          : [...(separate ? [] : defaults.values()), ...rules].join('\n'),
      resources: separate
        ? [
            ...[...defaults].map(([id, css]) => ({ css, id })),
            // Scope rules stay together to preserve cascade order without one import per token.
            ...(separate === 'all' && rules.length
              ? [
                  {
                    css: rules.join('\n'),
                    id: JSON.stringify([
                      classes,
                      [...contracts.values()].flatMap((contract) => [
                        ...contract.paths.values(),
                      ]),
                    ]),
                  },
                ]
              : []),
          ]
        : [],
    }
  }

  function literal(value: Token.Value, label?: string): string {
    if (Token.is(value)) return serialize(value)
    if (typeof value !== 'object') return String(value)
    if ('default' in value) {
      // Separate fallback properties preserve extensions and resolve references within each scope.
      const base = literal(value.default, label)
      const rules = [`:where(*){--fallback:${base};}`]
      conditional(value, '--fallback', ':where(*)', rules, label)
      const css = rules.join('')
      const name = label
        ? `--z-${Identity.label(label)}-fallback-${Identity.compact(css)}`
        : `--z-f${Identity.hash(css)}`
      const emitted = [`:where(*){${name}:${base};}`]
      conditional(value, name, ':where(*)', emitted, label)
      defaults.set(name, emitted.join(''))
      return `var(${name})`
    }
    return `light-dark(${literal(value.light, label)},${literal(value.dark, label)})`
  }

  function conditional(
    value: Token.Value,
    name: string,
    selector: string,
    rules: string[],
    label?: string,
  ) {
    if (
      !value ||
      typeof value !== 'object' ||
      Token.is(value) ||
      !('default' in value)
    )
      return
    conditional(value.default, name, selector, rules, label)
    for (const [query, entry] of Object.entries(value)) {
      if (query === 'default') continue
      const nested = [`${selector}{${name}:${literal(entry, label)};}`]
      conditional(entry, name, selector, nested, label)
      rules.push(`${query}{${nested.join('')}}`)
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

/** One generated definition whose scope order must remain intact. */
export type Resource = {
  /** Complete fallback or scoped token definition. */
  readonly css: string
  /** Stable identity for stylesheet replacement during development. */
  readonly id: string
}

/** Selects independently shareable defaults or all token rules. */
export const shared = Symbol('shared token rules')

function variable(index: number | string, path: string): string {
  // Packed declarations retain the spelling assigned by their compiler.
  if (typeof index === 'string' && index.startsWith('src-'))
    return `--z-${Identity.label(path)}-${Identity.compact(JSON.stringify([index, path]))}`
  return `--z-t${encode(String(index))}-${encode(path)}`
}
