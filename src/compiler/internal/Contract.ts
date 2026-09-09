/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'

/** Reads versioned JSON as validated data; never evaluates package code. */
export function read(source: string, identities: Map<string, Token.Contract>) {
  const data = record(JSON.parse(source))
  if (data.version !== 1) throw new Error('Unsupported Zyzz contract version.')
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const types: Record<string, string> = Object.create(null)
  for (const [name, value] of Object.entries(record(data.themes))) {
    const entry = record(value)
    const identity = string(entry.identity)
    let contract = identities.get(identity)
    if (!contract) {
      contract = Object.freeze({
        [Token.complete]: true,
        [Token.identity]: identity,
      })
      identities.set(identity, contract)
    }
    const definition = Theme.define(record(entry.tokens) as Theme.Tokens)
    themes[name] = Token.bind(definition, contract)
    types[name] = type(tokens(definition.tokens))
  }
  const links: Record<string, Themes.Link> = Object.create(null)
  for (const [name, value] of Object.entries(record(data.exports))) {
    const entry = record(value)
    const theme = string(entry.theme)
    const definition = themes[theme]
    if (!definition || (entry.kind !== 'css' && entry.kind !== 'theme'))
      throw new Error('Invalid Zyzz contract export.')
    links[name] = {
      binding: string(entry.binding),
      call: { end: -1, name: theme, start: -1, tokenType: types[theme]! },
      definition,
      kind: entry.kind,
    }
  }
  return { links, themes }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a Zyzz contract record.')
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value)
    throw new Error('Expected a nonempty Zyzz contract identity.')
  return value
}

function tokens(tree: Theme.References<Theme.Tokens>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(tree).map(([name, value]) => [
      name,
      Token.is(value)
        ? value.value
        : tokens(value as Theme.References<Theme.Tokens>),
    ]),
  )
}

function type(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  return `{${Object.entries(value)
    .map(([key, value]) => `readonly ${JSON.stringify(key)}:${type(value)}`)
    .join(';')}}`
}

/** Emits compiler-only metadata without adding it to the runtime module. */
export function write(
  links: Readonly<Record<string, Themes.Link>>,
  themes: Readonly<Record<string, Theme.Definition>>,
): string {
  return JSON.stringify({
    exports: Object.fromEntries(
      Object.entries(links).map(([name, link]) => [
        name,
        { binding: link.binding, kind: link.kind, theme: link.call.name },
      ]),
    ),
    themes: Object.fromEntries(
      Object.entries(themes).map(([name, theme]) => [
        name,
        {
          identity: theme[Token.definition].contract[Token.identity],
          tokens: tokens(theme.tokens),
        },
      ]),
    ),
    version: 1,
  })
}
