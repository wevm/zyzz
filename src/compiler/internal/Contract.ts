/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import * as Stylesheets from './Stylesheets.js'
import * as Marker from '../../runtime/Marker.js'
import * as Config from '../../Config.js'
import * as Configurations from './Configurations.js'
import * as Shorthands from '../../internal/Shorthands.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'

/** Reads versioned JSON as validated data; never evaluates package code. */
export function read(source: string, identities: Map<string, Token.Contract>) {
  const data = record(JSON.parse(source))
  if (![1, 2, 3, 4, 5, 6, 7].includes(data.version as number))
    throw new Error('Unsupported Zyzz contract version.')
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const types: Record<string, string> = Object.create(null)
  for (const [name, value] of Object.entries(record(data.themes))) {
    const entry = record(value)
    const identity = string(entry.identity)
    const shorthands =
      entry.shorthands !== undefined
        ? Shorthands.read(entry.shorthands)
        : undefined
    let contract = identities.get(identity)
    if (
      contract &&
      Shorthands.signature(contract.shorthands) !==
        Shorthands.signature(shorthands)
    )
      throw new Error(
        'Conflicting packed shorthand mappings for one theme identity.',
      )
    if (!contract) {
      contract = Object.freeze({
        ...(entry.shorthands !== undefined
          ? { shorthands: Shorthands.read(entry.shorthands) }
          : {}),
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
    if (entry.kind === 'animation') {
      const name = string(entry.name)
      if (!/^z-k[a-z0-9-]+$/.test(name))
        throw new Error('Invalid animation identity.')
      return {
        binding: string(entry.binding),
        kind: 'animation',
        definition: Theme.define({}),
        call: { start: -1, end: -1, name, tokenType: '{}' },
      }
    }
    if (entry.kind === 'marker') {
      const marker = record(entry.marker)
      const id = string(marker.id)
      if (!/^data-z-[a-z0-9_-]+$/.test(id))
        throw new Error('Invalid marker identity.')
      return {
        binding: string(entry.binding),
        kind: 'marker',
        definition: Theme.define({}),
        call: {
          start: -1,
          end: -1,
          name: id,
          tokenType: '{}',
          marker: { id, schema: Marker.schema(marker.schema) },
        },
      }
    }
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
    if (options) {
      Config.create(options as Config.create.Options)
      if (
        Shorthands.signature(options.shorthands) !==
        Shorthands.signature(definition[Token.definition].contract.shorthands)
      )
        throw new Error(
          'Configuration mappings disagree with linked theme metadata.',
        )
    }

    if (entry.kind === 'config' && !options)
      throw new Error('Missing configuration options.')
    return {
      binding: string(entry.binding),
      call: {
        ...(entry.script === true ? { script: true } : {}),
        end: -1,
        name: theme,
        start: -1,
        tokenType: types[theme]!,
        ...(definition[Token.definition].contract.shorthands
          ? {
              type: `import('zyzz').Config.create.ReturnType<{theme:${types[theme]!};shorthands:${Configurations.type(definition[Token.definition].contract.shorthands!)}}>['theme']`,
            }
          : {}),
        ...(entry.selection === true ? { selection: true } : {}),
        ...(entry.initialization === true ? { initialization: true } : {}),
        ...(options
          ? {
              options,
              type: `import('zyzz').Config.create.ReturnType<${Configurations.type(options)}>${entry.initialization === true ? "['script']" : entry.selection === true ? "['themes']" : ''}`,
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
  return { links, themes, stylesheets: Stylesheets.read(data.stylesheets) }
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
  stylesheets: readonly Stylesheets.Section[] = [],
): string {
  function entry(link: Themes.Link): Record<string, unknown> {
    if (link.kind === 'animation')
      return { binding: link.binding, kind: link.kind, name: link.call.name }
    if (link.kind === 'marker')
      return {
        binding: link.binding,
        kind: link.kind,
        marker: link.call.marker,
      }
    return {
      ...(link.call.script &&
      (link.kind === 'config' || link.call.initialization)
        ? { script: true }
        : {}),
      binding: link.binding,
      kind: link.kind,
      theme: link.call.name,
      ...(link.call.selection ? { selection: true } : {}),
      ...(link.call.initialization ? { initialization: true } : {}),
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
    ...(stylesheets.length ? { stylesheets } : {}),
    exports: Object.fromEntries(
      Object.entries(links).map(([name, link]) => [name, entry(link)]),
    ),
    themes: Object.fromEntries(
      Object.entries(themes).map(([name, theme]) => [
        name,
        {
          ...(theme[Token.definition].contract.shorthands
            ? { shorthands: theme[Token.definition].contract.shorthands }
            : {}),
          identity: theme[Token.definition].contract[Token.identity],
          tokens: input(theme),
        },
      ]),
    ),
    version:
      stylesheets.length ||
      Object.values(links).some((link) => link.kind === 'animation')
        ? 7
        : Object.values(links).some((link) => link.kind === 'marker')
          ? 6
          : Object.values(themes).some(
                (theme) => theme[Token.definition].contract.shorthands,
              )
            ? 5
            : stylesheets.length ||
                Object.values(links).some(
                  (link) =>
                    link.call.selection ||
                    (link.kind === 'config' && !!link.call.options?.themes) ||
                    link.call.initialization ||
                    (link.kind === 'config' && link.call.script) ||
                    link.kind === 'marker' ||
                    link.kind === 'animation',
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
