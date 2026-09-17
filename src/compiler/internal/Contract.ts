/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import type * as Binding from '../../internal/Binding.js'
import * as Config from '../../Config.js'
import * as Configurations from './Configurations.js'
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Identifiers from './Identifiers.js'
import * as PackedStyles from './PackedStyles.js'
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
    ![
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22,
    ].includes(data.version as number)
  )
    throw new Error('Unsupported Zyzz contract version.')

  // Root controls arrived with version 18; older readers must treat them as absent.
  const rootControls = (data.version as number) >= 18
  const legacyModes = new Map<string, 'atomic' | 'grouped'>()
  if ((data.version as number) < 17) {
    function collect(value: unknown) {
      const entry = record(value)
      if (entry.options !== undefined && entry.theme !== undefined) {
        const options = record(entry.options)
        if (options.cssOutput !== undefined) {
          if (options.cssOutput !== 'atomic' && options.cssOutput !== 'grouped')
            throw new Error('Invalid packed CSS output mode.')
          const theme = record(record(data.themes)[string(entry.theme)])
          const identity = string(theme.identity)
          const previous = legacyModes.get(identity)
          if (previous !== undefined && previous !== options.cssOutput)
            throw new Error(
              'Conflicting packed CSS output modes for one theme identity.',
            )
          legacyModes.set(identity, options.cssOutput)
        }
      }
      for (const member of Object.values(record(entry.members ?? {})))
        collect(member)
    }
    for (const entry of Object.values(record(data.exports))) collect(entry)
  }

  const themes: Record<string, Theme.Definition> = Object.create(null)
  const types: Record<string, string> = Object.create(null)

  for (const [name, value] of Object.entries(record(data.themes))) {
    const entry = record(value)
    const identity = string(entry.identity)
    if (
      entry.cssOutput !== undefined &&
      entry.cssOutput !== 'atomic' &&
      entry.cssOutput !== 'grouped'
    )
      throw new Error('Invalid packed CSS output mode.')
    const cssOutput = (entry.cssOutput ?? legacyModes.get(identity)) as
      | 'atomic'
      | 'grouped'
      | undefined

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

    if (
      contract &&
      (contract.cssOutput ?? 'atomic') !== (cssOutput ?? 'atomic')
    )
      throw new Error(
        'Conflicting packed CSS output modes for one theme identity.',
      )

    if (!contract) {
      contract = Object.freeze({
        ...(entry.shorthands !== undefined
          ? { shorthands: Shorthands.read(entry.shorthands) }
          : {}),
        ...(cssOutput ? { cssOutput } : {}),
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
    const raw = record(value)
    // Contracts before version 19 record style authoring exports as `css`.
    const entry =
      raw.kind === 'css' && (data.version as number) < 19
        ? { ...raw, kind: 'style' }
        : raw

    if (entry.kind === 'variables') {
      if ((data.version as number) < 14)
        throw new Error(
          'Legacy variable contracts require recompilation with variable().',
        )
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
              '*',
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
              type: slot.type as Binding.Domain,
              variable: true as const,
            }),
          ]
        }),
      )

      const binding = string(entry.binding)

      return {
        binding,
        kind: 'variables',
        ...(entry.members
          ? {
              members: Object.fromEntries(
                Object.entries(record(entry.members)).map(([name, value]) => [
                  name,
                  link(value),
                ]),
              ),
            }
          : {}),
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
        ![9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].includes(
          data.version as number,
        ) ||
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

    if (entry.kind === 'style-reference') {
      if (
        entry.style !== undefined &&
        ![16, 17, 18, 19, 20, 21, 22].includes(data.version as number)
      )
        throw new Error(
          'Packed callable styles require contract version 16 or later.',
        )
      const binding = string(entry.binding)
      if (!/^z-style-[a-z0-9_-]+$/.test(binding))
        throw new Error('Invalid style reference identity.')
      const members =
        entry.members === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(record(entry.members)).map(([key, value]) => {
                const member = link(value)
                if (
                  member.kind !== 'style-reference' ||
                  (member.members && (data.version as number) < 22)
                )
                  throw new Error('Invalid style reference member.')
                return [key, member]
              }),
            )
      return {
        binding,
        call: {
          start: -1,
          end: -1,
          name: members ? '' : binding,
          tokenType: '{}',
        },
        definition: Theme.define({}),
        kind: 'style-reference',
        ...(entry.style === undefined
          ? {}
          : {
              style: PackedStyles.read(
                entry.style,
                themes,
                data.version as number,
              ),
            }),
        ...(members ? { members } : {}),
      }
    }

    if (entry.output !== undefined && entry.output !== 'html')
      throw new Error('Invalid theme output.')

    if (
      entry.recipe !== undefined &&
      (entry.recipe !== true ||
        (data.version as number) < 15 ||
        entry.kind !== 'style')
    )
      throw new Error('Invalid bound recipe contract.')

    const theme = string(entry.theme)
    const definition = themes[theme]
    if (
      !definition ||
      !['config', 'style', 'theme'].includes(String(entry.kind))
    )
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
        (data.version as number) >= 17 &&
        (options.cssOutput ?? 'atomic') !==
          (definition[Token.definition].contract.cssOutput ?? 'atomic')
      )
        throw new Error(
          'Configuration CSS output disagrees with linked theme metadata.',
        )

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
    // Helpers a legacy library did not compile are hidden from its consumers' types.
    const hidden = [
      ...(rootControls && entry.appearance === true ? [] : ["'appearance'"]),
      ...(entry.script === true ? [] : ["'script'"]),
    ]
    const configType = hidden.length
      ? `{readonly [key in keyof ${fullConfigType} as key extends ${hidden.join(' | ')} ? never : key]:${fullConfigType}[key]}`
      : fullConfigType
    const outputType = catalogOnly
      ? `({readonly [key in keyof ${configType} as key extends 'themes' ? never : key]:${configType}[key]} & {readonly themes:{readonly [key in keyof ${configType}['themes']]:${configType}['themes'][key]}})`
      : configType
    if (entry.kind === 'config' && !options)
      throw new Error('Missing configuration options.')

    return {
      binding: string(entry.binding),
      call: {
        ...(entry.recipe === true ? { recipe: true } : {}),
        ...(entry.output === 'html' ? { output: 'html' as const } : {}),
        ...(catalogOnly ? { catalogOnly: true } : {}),
        ...(entry.script === true ? { script: true } : {}),
        ...(rootControls && entry.appearance === true
          ? { appearance: true }
          : {}),
        ...(rootControls && entry.root === true ? { root: true } : {}),
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
              type: `${outputType}${entry.initialization === true ? "['script']" : entry.root === true ? "['appearance']" : entry.selection === true ? "['themes']" : ''}`,
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
  configurations: readonly write.Configuration[] = [],
): string {
  function entry(link: Themes.Link): Record<string, unknown> {
    if (link.kind === 'variables')
      return {
        binding: link.binding,
        kind: link.kind,
        variables: link.call.variables,
        ...(link.members
          ? {
              members: Object.fromEntries(
                Object.entries(link.members).map(([name, member]) => [
                  name,
                  entry(member),
                ]),
              ),
            }
          : {}),
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

    if (link.kind === 'style-reference')
      return {
        binding: link.binding,
        kind: link.kind,
        ...(link.style ? { style: PackedStyles.write(link.style) } : {}),
        ...(link.members
          ? {
              members: Object.fromEntries(
                Object.entries(link.members).map(([name, value]) => [
                  name,
                  entry(value),
                ]),
              ),
            }
          : {}),
      }

    return {
      ...(link.call.recipe ? { recipe: true } : {}),
      ...(link.call.output ? { output: link.call.output } : {}),
      ...(link.call.script &&
      (link.kind === 'config' || link.call.initialization)
        ? { script: true }
        : {}),
      ...(link.call.appearance && (link.kind === 'config' || link.call.root)
        ? { appearance: true }
        : {}),
      binding: link.binding,
      kind: link.kind,
      theme: link.call.name,
      ...(link.call.catalogOnly ? { catalogOnly: true } : {}),
      ...(link.call.selection ? { selection: true } : {}),
      ...(link.call.initialization ? { initialization: true } : {}),
      ...(link.call.root ? { root: true } : {}),
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
    // Local configurations publish their catalogs so documents restore
    // selections for modules that export styles but not the configuration.
    ...(configurations.length ? { configurations } : {}),
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
          ...(theme[Token.definition].contract.cssOutput
            ? { cssOutput: theme[Token.definition].contract.cssOutput }
            : {}),
          identity: theme[Token.definition].contract[Token.identity],
          tokens: input(theme),
        },
      ]),
    ),
    version: (() => {
      function callable(link: Themes.Link): boolean {
        return !!link.style || Object.values(link.members ?? {}).some(callable)
      }
      function styled(link: Themes.Link): boolean {
        return (
          link.kind === 'style' ||
          Object.values(link.members ?? {}).some(styled)
        )
      }
      function branches(style: import('../../Style.js').NamedStyle): boolean {
        return (
          !!style.targets || !!style.rules?.some((rule) => branches(rule.style))
        )
      }
      function targeted(link: Themes.Link): boolean {
        return (
          (link.style && branches(link.style.style)) ||
          Object.values(link.members ?? {}).some(targeted)
        )
      }
      function staticRecipe(link: Themes.Link): boolean {
        return (
          !!link.style?.staticRecipe ||
          Object.values(link.members ?? {}).some(staticRecipe)
        )
      }
      function nested(link: Themes.Link): boolean {
        return Object.values(link.members ?? {}).some(
          (member) =>
            (link.kind === 'style-reference' && !!member.members) ||
            nested(member),
        )
      }
      if (Object.values(links).some(nested)) return 22
      if (Object.values(links).some(staticRecipe)) return 21
      if (Object.values(links).some(targeted)) return 20
      // Style authoring exports serialize as `style`; older readers only know `css`.
      if (Object.values(links).some(styled)) return 19
      // Root controls call a runtime helper older releases lack, and older
      // readers reject the storageKey option, so both require readers to opt in.
      // Local configurations emit the same helper without an exported binding.
      if (
        configurations.length ||
        Object.values(links).some(
          (link) =>
            (link.call.appearance &&
              (link.kind === 'config' || link.call.root)) ||
            link.call.options?.storageKey !== undefined,
        )
      )
        return 18
      if (
        Object.values(links).some(callable) ||
        Object.values(themes).some(
          (theme) => theme[Token.definition].contract.cssOutput,
        )
      )
        return 17
      if (Object.values(links).some((link) => link.call.recipe)) return 15
      if (Object.values(links).some((link) => link.kind === 'variables'))
        return 14
      if (Object.values(links).some((link) => link.kind === 'style-reference'))
        return 13

      if (
        Object.values(links).some(
          (link) => link.call.function && extended(link.call.function),
        )
      )
        return 12

      if (
        stylesheets.some((section) => section.namespaces?.length) ||
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
      )
        return 11

      if (
        Object.values(links).some(
          (link) =>
            link.call.reference === 'cssFunction' ||
            link.call.reference === 'customMedia',
        )
      )
        return 10

      if (Object.values(links).some((link) => link.kind === 'rule-reference'))
        return 9

      if (Object.values(links).some((link) => link.kind === 'variables'))
        return 8

      if (
        stylesheets.length ||
        Object.values(links).some((link) => link.kind === 'animation')
      )
        return 7

      if (
        Object.values(themes).some(
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
      )
        return 5

      if (
        stylesheets.length ||
        Object.values(links).some(
          (link) =>
            link.call.selection ||
            (link.kind === 'config' && !!link.call.options?.themes) ||
            link.call.initialization ||
            (link.kind === 'config' && link.call.script) ||
            link.kind === 'animation' ||
            link.kind === 'variables',
        )
      )
        return 4

      if (
        Object.values(themes).some(
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
      )
        return 3

      if (
        Object.values(links).some(
          (link) => link.kind === 'config' || link.call.type,
        )
      )
        return 2

      return 1
    })(),
  })
}

/** Contract writer contracts. */
export declare namespace write {
  /** Catalog of one configuration call, published whether or not the call is exported. */
  type Configuration = {
    /** Configuration identity that prefixes every theme scope key. */
    readonly identity: string
    /** localStorage key the configuration's script and root controls share. */
    readonly storageKey?: string | undefined
    /** Named theme keys of the configuration's catalog. */
    readonly themes: readonly string[]
  }
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
