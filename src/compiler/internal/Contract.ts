/**
 * Serializes validated theme authoring data for independently compiled libraries.
 * @module
 */
import type * as Binding from '../../internal/Binding.js'
import * as Config from '../../internal/Configuration.js'
import * as Configurations from './Configurations.js'
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Identifiers from './Identifiers.js'
import * as PackedStyles from './PackedStyles.js'
import * as Shorthands from '../../internal/Shorthands.js'
import * as Stylesheets from './Stylesheets.js'
import * as Theme from '../../internal/Theme.js'
import * as VariableSets from '../../internal/VariableSets.js'
import * as Vars from '../../Vars.js'
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
      22, 23, 24, 25, 26, 27, 28, 29, 30,
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

  function decode(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(decode)
    const fields = record(value)
    if (Object.hasOwn(fields, '$object'))
      return Object.fromEntries(
        Object.entries(record(fields.$object)).map(([key, value]) => [
          key,
          decode(value),
        ]),
      )
    if (Object.hasOwn(fields, '$composition')) {
      if ((data.version as number) < 29)
        throw new Error(
          'Composed variables require contract version 29 or later.',
        )
      const composition = record(fields.$composition)
      if (
        (composition.group !== 'color' && composition.group !== 'spacing') ||
        !Array.isArray(composition.parts)
      )
        throw new Error('Invalid packed variable composition.')
      return Vars.compose(
        composition.group,
        composition.parts.map(decode) as readonly (
          | string
          | number
          | Vars.Reference
        )[],
      )
    }
    if (Object.hasOwn(fields, '$variable')) {
      const reference = record(fields.$variable)
      const identity = string(reference.identity)
      let contract = identities.get(identity)
      if (contract && !contract.variableSet)
        throw new Error(
          'Conflicting packed variable-set modes for one identity.',
        )
      if (!contract) {
        contract = Object.freeze({
          variableSet: true,
          [Token.identity]: identity,
        })
        identities.set(identity, contract)
      }
      const resolved = decode(reference.value) as Token.Value
      return Token.create({
        contract,
        group: VariableSets.domain(resolved),
        path: string(reference.path),
        value: resolved,
      })
    }
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, decode(value)]),
    )
  }
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const types: Record<string, string> = Object.create(null)

  for (const [name, value] of Object.entries(record(data.themes))) {
    const entry = record(value)
    const identity = string(entry.identity)
    if (entry.variableSet === true && (data.version as number) < 28)
      throw new Error('Vars contracts require contract version 28 or later.')
    const mappings = VariableSets.mappings(entry.mappings)
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

    if (entry.defaultLayer !== undefined) {
      if ((data.version as number) < 27)
        throw new Error('Default layers require contract version 27 or later.')
      Config.create({ defaultLayer: entry.defaultLayer as string })
    }
    const defaultLayer = entry.defaultLayer as string | undefined

    const shorthands =
      entry.shorthands !== undefined
        ? Shorthands.read(entry.shorthands)
        : undefined
    let contract = identities.get(identity)
    if (
      contract &&
      Boolean(contract.variableSet) !== (entry.variableSet === true)
    )
      throw new Error('Conflicting packed variable-set modes for one identity.')
    if (
      contract &&
      JSON.stringify(contract.mappings ?? {}) !== JSON.stringify(mappings ?? {})
    )
      throw new Error('Conflicting packed variable mappings for one identity.')
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

    if (contract && contract.defaultLayer !== defaultLayer)
      throw new Error(
        'Conflicting packed default layers for one theme identity.',
      )

    if (!contract) {
      contract = Object.freeze({
        ...(entry.variableSet === true
          ? {
              variableSet: true,
              mappings,
            }
          : {}),
        ...(entry.shorthands !== undefined
          ? { shorthands: Shorthands.read(entry.shorthands) }
          : {}),
        ...(cssOutput ? { cssOutput } : {}),
        ...(defaultLayer !== undefined ? { defaultLayer } : {}),
        [Token.complete]: true,
        [Token.identity]: identity,
      })
      identities.set(identity, contract)
    }

    const definition =
      entry.variableSet === true
        ? VariableSets.theme(
            Vars.define(decode(entry.tokens) as Vars.Values),
            mappings,
          )
        : Theme.define(record(entry.tokens) as Theme.Tokens)
    if (
      (data.version as number) < 24 &&
      Object.hasOwn(definition.tokens, 'typography')
    )
      throw new Error(
        'Packed typography sets require contract version 24 or later.',
      )

    if (
      (data.version as number) < 25 &&
      (definition[Token.definition].paths ||
        Object.hasOwn(definition.tokens, 'borderWidth'))
    )
      throw new Error(
        'Packed responsive typography and border widths require contract version 25 or later.',
      )

    themes[name] = Token.bind(
      definition,
      contract,
      entry.cssName === undefined ? undefined : string(entry.cssName),
    )
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
            !/^--z-[a-zA-Z0-9_-]+$/.test(string(slot.name)) ||
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
        ![
          9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
          27, 28, 29, 30,
        ].includes(data.version as number) ||
        ![
          'cssFunction',
          'customMedia',
          'colorProfile',
          'counterStyle',
          'fontPaletteValues',
          'positionTry',
        ].includes(reference) ||
        !/^(?:--)?z-[a-zA-Z0-9_-]+$/.test(name) ||
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
      if (!/^z-k[a-zA-Z0-9_-]+$/.test(name))
        throw new Error('Invalid animation identity.')

      return {
        binding: string(entry.binding),
        kind: 'animation',
        definition: Theme.define({}),
        call: { start: -1, end: -1, name, tokenType: '{}' },
      }
    }

    if (entry.kind === 'style-reference') {
      if (entry.style !== undefined && (data.version as number) < 16)
        throw new Error(
          'Packed callable styles require contract version 16 or later.',
        )
      const binding = string(entry.binding)
      if (!/^z-style-[a-zA-Z0-9_-]+$/.test(binding))
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
      entry.options === undefined ? undefined : record(decode(entry.options))

    if (options) {
      if (
        entry.variableConfig === true &&
        JSON.stringify(VariableSets.mappings(entry.variableMappings) ?? {}) !==
          JSON.stringify(definition[Token.definition].contract.mappings ?? {})
      )
        throw new Error(
          'Configuration mappings disagree with linked variable metadata.',
        )
      if (entry.variableConfig === true)
        Config.create(
          variableOptions(
            options,
            entry.variableMappings as Vars.Mappings | false | undefined,
          ),
        )
      else Config.create(options as Config.create.Options)
      if (
        (data.version as number) >= 17 &&
        (options.cssOutput ?? 'atomic') !==
          (definition[Token.definition].contract.cssOutput ?? 'atomic')
      )
        throw new Error(
          'Configuration CSS output disagrees with linked theme metadata.',
        )

      if (
        options.defaultLayer !==
        definition[Token.definition].contract.defaultLayer
      )
        throw new Error(
          'Configuration default layer disagrees with linked theme metadata.',
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
      ? entry.variableConfig === true
        ? `import('zyzz').Config.VariableConfig<${Configurations.type(variableOptions(options, entry.variableMappings as Vars.Mappings | false | undefined))}>`
        : `import('zyzz').Config.create.ReturnType<${Configurations.type(options)}>`
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
        ...(entry.variableSet === true
          ? {
              variableSet: true,
              type: `import('zyzz').Vars.Definition<${types[theme]!}>`,
            }
          : {}),
        ...(entry.directVariables === true
          ? {
              directVariables: true,
              type: `import('zyzz').Vars.${entry.variableSet === true ? 'Definition' : 'References'}<${types[theme]!}>`,
            }
          : {}),
        ...(entry.variableConfig === true
          ? {
              variableConfig: true,
              variableMappings: entry.variableMappings as
                | Vars.Mappings
                | false
                | undefined,
            }
          : {}),
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
              type: `${outputType}${entry.initialization === true ? "['script']" : entry.root === true ? "['appearance']" : entry.selection === true ? (entry.variableConfig === true ? "['vars']" : "['themes']") : ''}`,
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

  const classRules = Object.fromEntries(
    Object.entries(
      data.classRules === undefined ? {} : record(data.classRules),
    ).map(([name, body]) => {
      if (!name || /\s/.test(name))
        throw new Error('Invalid packed class name.')
      return [name, string(body)]
    }),
  )

  return {
    classRules,
    links,
    themes,
    stylesheets: Stylesheets.read(data.stylesheets),
  }
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
  if (Token.is(value) || Token.isExpression(value))
    return Configurations.type(value)
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
  classRules: Readonly<Record<string, string>> = {},
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
      ...(link.call.variableSet ? { variableSet: true } : {}),
      ...(link.call.directVariables ? { directVariables: true } : {}),
      ...(link.call.variableConfig
        ? { variableConfig: true, variableMappings: link.call.variableMappings }
        : {}),
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
      ...(link.call.options ? { options: encode(link.call.options) } : {}),
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
    ...(Object.keys(classRules).length ? { classRules } : {}),
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
          ...(theme[Token.definition].cssName !== undefined
            ? { cssName: theme[Token.definition].cssName }
            : {}),
          ...(theme[Token.definition].contract.shorthands
            ? { shorthands: theme[Token.definition].contract.shorthands }
            : {}),
          ...(theme[Token.definition].contract.defaultLayer !== undefined
            ? { defaultLayer: theme[Token.definition].contract.defaultLayer }
            : {}),
          ...(theme[Token.definition].contract.cssOutput
            ? { cssOutput: theme[Token.definition].contract.cssOutput }
            : {}),
          ...(theme[Token.definition].contract.variableSet
            ? {
                variableSet: true,
                mappings: theme[Token.definition].contract.mappings,
              }
            : {}),
          identity: theme[Token.definition].contract[Token.identity],
          tokens: encode(input(theme)),
        },
      ]),
    ),
    version: 30,
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

function encode(value: unknown): unknown {
  if (Token.isExpression(value) && 'group' in value)
    return {
      $composition: { group: value.group, parts: value.parts.map(encode) },
    }
  if (Token.is(value))
    return {
      $variable: {
        identity: value.contract[Token.identity],
        path: value.path,
        value: encode(value.value),
      },
    }
  if (Array.isArray(value)) return value.map(encode)
  if (!value || typeof value !== 'object') return value
  const fields = Object.fromEntries(
    Object.entries(value).map(([key, value]) => [key, encode(value)]),
  )
  return Object.hasOwn(fields, '$composition') ||
    Object.hasOwn(fields, '$variable') ||
    Object.hasOwn(fields, '$object')
    ? { $object: fields }
    : fields
}

function variableOptions(
  options: Record<string, unknown>,
  mappings?: Vars.Mappings | false,
): Config.VariableOptions {
  const { theme, themes, defaultTheme, ...rest } = options
  return {
    ...rest,
    vars: (themes ?? theme) as Vars.Values,
    ...(themes ? { defaultVars: String(defaultTheme) } : {}),
    ...(mappings !== undefined ? { mappings } : {}),
  }
}
