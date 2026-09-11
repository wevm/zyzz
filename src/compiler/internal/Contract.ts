/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import * as Config from '../../Config.js'
import * as Configurations from './Configurations.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'

/** Reads versioned JSON as validated data; never evaluates package code. */
export function read(source: string, identities: Map<string, Token.Contract>) {
  const data = record(JSON.parse(source))
  if (![1, 2, 3, 4].includes(data.version as number))
    throw new Error('Unsupported Zyzz contract version.')
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
    types[name] = type(input(definition))
  }
  function link(value: unknown): Themes.Link {
    const entry = record(value)
    const theme = string(entry.theme)
    const definition = themes[theme]
    if (!definition || !['config', 'css', 'theme'].includes(String(entry.kind)))
      throw new Error('Invalid Zyzz contract export.')
    const members =
      entry.kind === 'config'
        ? Object.fromEntries(
            Object.entries(record(entry.members)).map(([key, value]) => [
              key,
              link(value),
            ]),
          )
        : undefined
    const options =
      entry.options === undefined ? undefined : record(entry.options)
    if (options) Config.create(options as Config.create.Options)
    const catalogOnly =
      !!options?.themes &&
      ((data.version as number) < 4 || entry.catalogOnly === true)
    const configType = options
      ? `import('zyzz').Config.create.ReturnType<${Configurations.type(options)}>`
      : ''
    const outputType = catalogOnly
      ? `({readonly [key in keyof ${configType} as key extends 'themes' ? never : key]:${configType}[key]} & {readonly themes:{readonly [key in keyof ${configType}['themes']]:${configType}['themes'][key]}})`
      : configType
    if (entry.kind === 'config' && !options)
      throw new Error('Missing configuration options.')
    return {
      binding: string(entry.binding),
      call: {
        ...(catalogOnly ? { catalogOnly: true } : {}),
        end: -1,
        name: theme,
        start: -1,
        tokenType: types[theme]!,
        ...(entry.selection === true ? { selection: true } : {}),
        ...(options
          ? {
              options,
              type: `${outputType}${entry.selection === true ? "['themes']" : ''}`,
            }
          : {}),
        ...(members
          ? {
              members: Object.fromEntries(
                Object.entries(members).map(([key, member]) => [
                  key,
                  member.call.name,
                ]),
              ),
            }
          : {}),
      },
      definition,
      kind: entry.kind as Themes.Link['kind'],
      ...(members ? { members } : {}),
    }
  }
  const links = Object.fromEntries(
    Object.entries(record(data.exports)).map(([name, value]) => [
      name,
      link(value),
    ]),
  )
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

function input(theme: Theme.Definition) {
  return { ...tokens(theme.tokens), ...theme[Token.definition].queries }
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
  if (Array.isArray(value)) return `readonly [${value.map(type).join(',')}]`
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
  function entry(link: Themes.Link): Record<string, unknown> {
    return {
      binding: link.binding,
      kind: link.kind,
      theme: link.call.name,
      ...(link.call.catalogOnly ? { catalogOnly: true } : {}),
      ...(link.call.selection ? { selection: true } : {}),
      ...(link.call.options ? { options: link.call.options } : {}),
      ...(link.members
        ? {
            members: Object.fromEntries(
              Object.entries(link.members).map(([key, link]) => [
                key,
                entry(link),
              ]),
            ),
          }
        : {}),
    }
  }
  return JSON.stringify({
    exports: Object.fromEntries(
      Object.entries(links).map(([name, link]) => [name, entry(link)]),
    ),
    themes: Object.fromEntries(
      Object.entries(themes).map(([name, theme]) => [
        name,
        {
          identity: theme[Token.definition].contract[Token.identity],
          tokens: input(theme),
        },
      ]),
    ),
    version: Object.values(links).some(
      (link) =>
        link.call.selection ||
        (link.kind === 'config' && !!link.call.options?.themes),
    )
      ? 4
      : Object.values(themes).some(
            (theme) =>
              theme[Token.definition].queries ||
              Object.keys(theme.tokens).some((group) =>
                [
                  'fontFamily',
                  'fontSize',
                  'fontWeight',
                  'lineHeight',
                  'letterSpacing',
                ].includes(group),
              ),
          )
        ? 3
        : Object.values(links).some(
              (link) => link.kind === 'config' || link.call.type,
            )
          ? 2
          : 1,
  })
}
