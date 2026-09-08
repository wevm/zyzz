/**
 * Collects live theme references and emits graph-local variables and scope rules.
 * @module
 */
import * as Literal from '../../internal/Literal.js'
import * as Token from '../../internal/Token.js'
import type * as Theme from '../../Theme.js'

/** Collects live token references within one in-memory compilation graph. */
export function create() {
  const contracts = new Map<
    Token.Contract,
    { index: number | string; paths: Set<string> }
  >()

  function serialize(
    token: Token.Reference,
    property: keyof Literal.Properties,
  ): string {
    if (!Token.accepts(token.group, property))
      throw new Error('Token group is incompatible with this property.')
    const value = token.value
    const values =
      typeof value === 'object' ? [value.dark, value.light] : [value]
    for (const value of values) {
      const message = Literal.validate(property, value)
      if (message) throw new Error(message)
    }
    let contract = contracts.get(token.contract)
    if (!contract) {
      contract = {
        index: token.contract[Token.identity] ?? contracts.size,
        paths: new Set(),
      }
      contracts.set(token.contract, contract)
    }
    contract.paths.add(token.path)
    return `var(${variable(contract.index, token.path)},${literal(value)})`
  }

  function emit(themes: Readonly<Record<string, Theme.Definition>>) {
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
      const className = `z_theme-${encode(name)}`
      classes[name] = className
      const contract = contracts.get(data.contract)
      if (!contract) continue
      const body = [...contract.paths]
        .map((path) => {
          const value = data.values[path]
          if (value === undefined)
            throw new Error('Theme scope is missing a live token.')
          return `${variable(contract.index, path)}:${literal(value)};`
        })
        .join('')
      rules.push(`.${className}{${body}}`)
    }
    return { classes: Object.freeze(classes), css: rules.join('\n') }
  }

  return { emit, serialize }
}

function encode(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )
}

function literal(value: Token.Value): string {
  return typeof value === 'object'
    ? `light-dark(${value.light},${value.dark})`
    : String(value)
}

function variable(index: number | string, path: string): string {
  return `--z-t${encode(String(index))}-${encode(path)}`
}
