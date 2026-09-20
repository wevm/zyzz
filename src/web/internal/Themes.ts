/**
 * Collects live theme references and emits graph-local variables and scope rules.
 * @module
 */
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

  const defaults = new Map<string, Token.Value>()

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

    if (token.contract.variableSet) defaults.set(name, value)
    return `var(${name},${literal(value)})`
  }

  function emit(
    themes: Readonly<Record<string, Theme.Definition | Vars.Definition>>,
    schemes = false,
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

          return `${name}:${literal(value)};`
        })
        .join('')

      rules.push(`.${className}{${body}}`)
      for (const [path, name] of contract.paths)
        conditional(data.values[path]!, name, `.${className}`, rules)
    }

    // Scheme rules travel with the module that can apply them, so lowered
    // light-dark() resolves wherever selection helpers load.
    if (schemes) rules.push(Scheme.css)

    const fallback: string[] = []
    for (const [name, value] of defaults) {
      fallback.push(`:root{${name}:${literal(value)};}`)
      conditional(value, name, ':root', fallback)
    }
    return {
      classes: Object.freeze(classes),
      css: [...fallback, ...rules].join('\n'),
    }
  }

  function literal(value: Token.Value): string {
    if (Token.is(value)) return serialize(value)
    if (typeof value !== 'object') return String(value)
    if ('default' in value) return literal(value.default)
    return `light-dark(${literal(value.light)},${literal(value.dark)})`
  }

  function conditional(
    value: Token.Value,
    name: string,
    selector: string,
    rules: string[],
  ) {
    if (
      !value ||
      typeof value !== 'object' ||
      Token.is(value) ||
      !('default' in value)
    )
      return
    conditional(value.default, name, selector, rules)
    for (const [query, entry] of Object.entries(value)) {
      if (query === 'default') continue
      const nested = [`${selector}{${name}:${literal(entry)};}`]
      conditional(entry, name, selector, nested)
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

function variable(index: number | string, path: string): string {
  return `--z-t${encode(String(index))}-${encode(path)}`
}
