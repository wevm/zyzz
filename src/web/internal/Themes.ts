/**
 * Serializes live theme references and combines generated scope rules.
 * @module
 */
import * as Identity from '../../internal/Identity.js'
import * as Token from '../../internal/Token.js'

/** Serializes live token references with graph-local variable names. */
export function create() {
  const contracts = new Map<
    Token.Contract,
    { identity: string | undefined; paths: Map<string, string> }
  >()

  const anonymous = new Map<Token.Contract, Map<string, string>>()
  let nextVariable = 0
  function property(contract: Token.Contract, path: string): string {
    const identity = contract[Token.identity]
    if (identity) return variable(identity, path)
    let paths = anonymous.get(contract)
    if (!paths) {
      paths = new Map()
      anonymous.set(contract, paths)
    }
    let name = paths.get(path)
    if (!name) {
      name = `--z${(nextVariable++).toString(36)}`
      paths.set(path, name)
    }
    return name
  }

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
      name = property(token.contract, token.path)
      contract.paths.set(token.path, name)
    }

    const label = token.path
    return `var(${name},${literal(value, label, token.contract)})`
  }

  function literal(
    value: Token.Value,
    label?: string,
    owner?: Token.Contract,
  ): string {
    if (Token.is(value)) return serialize(value)
    if (Token.isExpression(value))
      return value.parts
        .map((part) => (typeof part === 'string' ? part : serialize(part)))
        .join('')
    if (typeof value !== 'object') return String(value)
    if ('default' in value) {
      // Separate fallback properties preserve extensions and resolve references within each scope.
      const base = literal(value.default, label, owner)
      // Rule consolidation must not change existing variable identities, so the name hashes the fallback's CSS.
      const css = `:where(*){--fallback:${base};}${conditionalCss(value, '--fallback', ':where(*)', label, owner)}`
      const name = `${owner ? property(owner, label ?? 'value') : variable(undefined, label ?? 'value')}-fallback-${Identity.hash(css)}`
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

  return { serialize }
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

/** Names an authored scope without its private source identity. */
export function scope(value: string, identity?: string): string {
  const namespace = identity?.startsWith('id-') ? `${identity.slice(3)}-` : ''
  return `z-theme-${namespace}${Identity.name(value)}`
}

function variable(identity: string | undefined, path: string): string {
  const namespace = identity?.startsWith('id-') ? `${identity.slice(3)}-` : ''
  return `--z-${namespace}${path.split('.').map(Identity.name).join('-')}`
}
