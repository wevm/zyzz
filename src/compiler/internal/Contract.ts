/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import type * as Binding from '../../internal/Binding.js'
import * as Config from '../../Config.js'
import * as Configurations from './Configurations.js'
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Identifiers from './Identifiers.js'
import * as Shorthands from '../../internal/Shorthands.js'
import * as Stylesheets from './Stylesheets.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'
import * as Token from '../../internal/Token.js'

/** Reads versioned JSON as validated data; never evaluates package code. */
export function read(
  source: string,
  identities: Map<string, Token.Contract>,
  moduleId = '',
) {
  const data = record(JSON.parse(source))
  if (
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(
      data.version as number,
    )
  )
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

    if (entry.kind === 'variables') {
      const names = new Set<string>()

      const slots = Object.fromEntries(
        Object.entries(record(entry.variables)).map(([key, value]) => {
          const slot = record(value)
          if (
            key === 'set' ||
            key === '__proto__' ||
            names.has(string(slot.name)) ||
            !/^--z-v[a-z0-9-]+$/.test(string(slot.name)) ||
            ![
              'color',
              'length',
              'number',
              'percentage',
              'signedLength',
              'signedPercentage',
            ].includes(String(slot.type))
          )
            throw new Error('Invalid packed variable contract.')

          names.add(string(slot.name))

          return [
            key,
            Object.freeze({
              name: slot.name as `--${string}`,
              type: slot.type as Binding.Kind,
              variable: true as const,
            }),
          ]
        }),
      )

      const binding = string(entry.binding)

      return {
        binding,
        kind: 'variables',
        definition: Theme.define({}),
        call: {
          start: -1,
          end: -1,
          name: binding,
          tokenType: '{}',
          variables: Object.freeze(slots),
          ...(entry.source !== undefined
            ? {
                variableOwner: Stylesheets.resolve(
                  moduleId,
                  string(entry.source),
                ),
              }
            : {}),
        },
      }
    }
    if (entry.kind === 'rule-reference') {
      const name = string(entry.name)
      const reference = string(entry.reference)
      if (
        ![9, 10, 11, 12].includes(data.version as number) ||
        ![
          'cssFunction',
          'customMedia',
          'colorProfile',
          'counterStyle',
          'fontPaletteValues',
          'positionTry',
        ].includes(reference) ||
        !/^(?:--)?z-[a-z0-9-]+$/.test(name) ||
        !name.startsWith(
          `${reference === 'counterStyle' ? '' : '--'}z-${reference.toLowerCase()}`,
        ) ||
        entry.binding !== name
      )
        throw new Error('Invalid named stylesheet identity.')
      return {
        binding: string(entry.binding),
        kind: 'rule-reference',
        definition: Theme.define({}),
        call: {
          start: -1,
          end: -1,
          name,
          tokenType: '{}',
          reference: reference as NonNullable<Themes.Call['reference']>,
          ...(reference === 'cssFunction'
            ? { function: signature(entry.function, data.version as number) }
            : {}),
        },
      }
    }

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

    if (entry.kind === 'style') {
      if ((data.version as number) < 13)
        throw new Error('Style identities require contract version 13.')

      const name = entry.name === undefined ? '' : string(entry.name)
      if (name && (!/^style-[a-z0-9-]+$/.test(name) || entry.binding !== name))
        throw new Error('Invalid style identity.')

      const members =
        entry.members === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(record(entry.members)).map(([key, value]) => {
                const member = link(value)
                if (member.kind !== 'style' || !member.call.name)
                  throw new Error('Invalid style namespace member.')

                return [key, member]
              }),
            )

      if (!name === !members) throw new Error('Invalid style identity.')

      return {
        binding: string(entry.binding),
        kind: 'style',
        definition: Theme.define({}),
        call: { start: -1, end: -1, name, tokenType: '{}' },
        ...(members ? { members } : {}),
      }
    }

    if (entry.output !== undefined && entry.output !== 'html')
      throw new Error('Invalid theme output.')

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

    const catalogOnly =
      !!options?.themes &&
      ((data.version as number) < 4 || entry.catalogOnly === true)
    const fullConfigType = options
      ? `import('zyzz').Config.create.ReturnType<${Configurations.type(options)}>`
      : ''
    const configType =
      entry.script === true
        ? fullConfigType
        : `{readonly [key in keyof ${fullConfigType} as key extends 'script' ? never : key]:${fullConfigType}[key]}`
    const outputType = catalogOnly
      ? `({readonly [key in keyof ${configType} as key extends 'themes' ? never : key]:${configType}[key]} & {readonly themes:{readonly [key in keyof ${configType}['themes']]:${configType}['themes'][key]}})`
      : configType
    if (entry.kind === 'config' && !options)
      throw new Error('Missing configuration options.')

    return {
      binding: string(entry.binding),
      call: {
        ...(entry.output === 'html' ? { output: 'html' as const } : {}),
        ...(catalogOnly ? { catalogOnly: true } : {}),
        ...(entry.script === true ? { script: true } : {}),
        end: -1,
        name: theme,
        start: -1,
        tokenType: types[theme]!,
        ...(definition[Token.definition].contract.shorthands ||
        entry.output === 'html'
          ? {
              type: `import('zyzz').Config.create.ReturnType<{theme:${types[theme]!};${entry.output === 'html' ? "output:'html';" : ''}shorthands:${Configurations.type(definition[Token.definition].contract.shorthands ?? {})}}>['theme']`,
            }
          : {}),
        ...(entry.selection === true ? { selection: true } : {}),
        ...(entry.initialization === true ? { initialization: true } : {}),
        ...(options
          ? {
              options,
              type: `${outputType}${entry.initialization === true ? "['script']" : entry.selection === true ? "['themes']" : ''}`,
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
  moduleId = '',
): string {
  function entry(link: Themes.Link): Record<string, unknown> {
    if (link.kind === 'variables')
      return {
        binding: link.binding,
        kind: link.kind,
        variables: link.call.variables,
        ...(link.call.variableOwner
          ? { source: Stylesheets.relative(moduleId, link.call.variableOwner) }
          : {}),
      }
    if (link.kind === 'rule-reference')
      return {
        binding: link.binding,
        kind: link.kind,
        name: link.call.name,
        reference: link.call.reference,
        ...(link.call.function ? { function: link.call.function } : {}),
      }

    if (link.kind === 'animation')
      return { binding: link.binding, kind: link.kind, name: link.call.name }

    if (link.kind === 'style')
      return {
        binding: link.binding,
        kind: link.kind,
        ...(link.call.name ? { name: link.call.name } : {}),
        ...(link.members
          ? {
              members: Object.fromEntries(
                Object.entries(link.members).map(([key, member]) => [
                  key,
                  entry(member),
                ]),
              ),
            }
          : {}),
      }

    return {
      ...(link.call.output ? { output: link.call.output } : {}),
      ...(link.call.script &&
      (link.kind === 'config' || link.call.initialization)
        ? { script: true }
        : {}),
      binding: link.binding,
      kind: link.kind,
      theme: link.call.name,
      ...(link.call.catalogOnly ? { catalogOnly: true } : {}),
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
    ...(stylesheets.length
      ? { stylesheets: Stylesheets.write(stylesheets) }
      : {}),
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
    version: Object.values(links).some((link) => link.kind === 'style')
      ? 13
      : Object.values(links).some(
            (link) => link.call.function && extended(link.call.function),
          )
        ? 12
        : stylesheets.some((section) => section.namespaces?.length) ||
            Object.values(links).some(
              (link) =>
                link.call.function &&
                [
                  link.call.function.returns,
                  ...link.call.function.parameters.map(
                    (parameter) => parameter.syntax ?? '*',
                  ),
                ].some(
                  (syntax) =>
                    // Version 10 readers accepted this fixed scalar subset.
                    !(
                      [
                        '*',
                        '<angle>',
                        '<color>',
                        '<integer>',
                        '<length>',
                        '<length-percentage>',
                        '<number>',
                        '<percentage>',
                        '<time>',
                      ] as readonly string[]
                    ).includes(syntax),
                ),
            )
          ? 11
          : Object.values(links).some(
                (link) =>
                  link.call.reference === 'cssFunction' ||
                  link.call.reference === 'customMedia',
              )
            ? 10
            : Object.values(links).some(
                  (link) => link.kind === 'rule-reference',
                )
              ? 9
              : Object.values(links).some((link) => link.kind === 'variables')
                ? 8
                : stylesheets.length ||
                    Object.values(links).some(
                      (link) => link.kind === 'animation',
                    )
                  ? 7
                  : Object.values(themes).some(
                        (theme) =>
                          theme[Token.definition].contract.shorthands ||
                          Object.hasOwn(theme.tokens, 'margin') ||
                          Object.hasOwn(theme.tokens, 'padding'),
                      ) ||
                      Object.values(links).some(
                        (link) =>
                          link.call.output === 'html' ||
                          Object.values(link.members ?? {}).some(
                            (member) => member.call.output === 'html',
                          ),
                      )
                    ? 5
                    : stylesheets.length ||
                        Object.values(links).some(
                          (link) =>
                            link.call.selection ||
                            (link.kind === 'config' &&
                              !!link.call.options?.themes) ||
                            link.call.initialization ||
                            (link.kind === 'config' && link.call.script) ||
                            link.kind === 'animation' ||
                            link.kind === 'variables',
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
                              (link) =>
                                link.kind === 'config' || link.call.type,
                            )
                          ? 2
                          : 1,
  })
}

function signature(
  input: unknown,
  version: number,
): NonNullable<Themes.Call['function']> {
  const value = record(input)
  if (
    !FunctionSyntax.accepts(string(value.returns)) ||
    !Array.isArray(value.parameters)
  )
    throw new Error('Invalid packed CSS function signature.')
  if (
    version < 12 &&
    (/[\\\u0080-\uffff]/.test(String(value.returns)) ||
      value.parameters.some((input) => {
        const parameter = record(input)
        return /[\\\u0080-\uffff]/.test(
          string(parameter.name) + string(parameter.syntax ?? '*'),
        )
      }))
  )
    throw new Error(
      'Extended CSS function signatures require contract version 12.',
    )
  const names = new Set<string>()
  const parameters = value.parameters.map((input: unknown) => {
    const parameter = record(input)
    const name = string(parameter.name)
    if (
      !Identifiers.read(name)?.startsWith('--') ||
      Identifiers.read(name) === '--' ||
      names.has(Identifiers.read(name)!) ||
      (parameter.syntax !== undefined &&
        !FunctionSyntax.accepts(string(parameter.syntax))) ||
      (parameter.default !== undefined &&
        typeof parameter.default !== 'number' &&
        typeof parameter.default !== 'string')
    )
      throw new Error('Invalid packed CSS function parameter.')
    names.add(Identifiers.read(name)!)
    return {
      name: name as `--${string}`,
      ...(parameter.syntax !== undefined
        ? {
            syntax: parameter.syntax as NonNullable<
              Themes.Call['function']
            >['returns'],
          }
        : {}),
      ...(parameter.default !== undefined
        ? { default: parameter.default as string | number }
        : {}),
    }
  })
  return {
    parameters,
    returns: value.returns as NonNullable<Themes.Call['function']>['returns'],
  }
}

function extended(signature: NonNullable<Themes.Call['function']>): boolean {
  return (
    /[\\\u0080-\uffff]/.test(signature.returns) ||
    signature.parameters.some((parameter) =>
      /[\\\u0080-\uffff]/.test(parameter.name + (parameter.syntax ?? '*')),
    )
  )
}
