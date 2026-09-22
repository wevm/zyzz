/**
 * Links a closed graph of source modules without executing code or reading files.
 * @module
 */
import * as Contributions from './internal/Contributions.js'
import * as Stylesheets from './internal/Stylesheets.js'
import type * as Mapping from '@jridgewell/gen-mapping'
import * as Css from '../web/Css.js'
import * as Native from './Native.js'
import * as Edits from './internal/Edits.js'
import * as Identity from '../internal/Identity.js'
import type * as Ast from '@oxc-project/types'
import * as Parser from 'oxc-parser'
import * as Syntax from './internal/Syntax.js'
import * as Walker from 'oxc-walker'
import type * as Theme from '../internal/Theme.js'
import * as Token from '../internal/Token.js'
import * as Contract from './internal/Contract.js'
import * as Relative from './internal/Relative.js'
import * as Themes from './internal/Themes.js'
import * as Source from './Source.js'
import * as Scope from './internal/Scope.js'
import * as Static from './internal/Static.js'
import * as Transform from './Transform.js'

/** Compiles supplied modules with shared theme contracts and dependency metadata. */
export function compile(options: compile.Options): compile.ReturnType {
  return build(options).result
}

/** Input and output of graph compilation. */
export declare namespace compile {
  /** Errors raised while extracting or compiling a source graph. */
  type ErrorType =
    | Native.compile.ErrorType
    | Source.ExtractError
    | Transform.compile.ErrorType

  /** Source modules available for relative import resolution. */
  type Options = {
    /** Host entrypoints emit owned stylesheet effects without packed contracts. */
    readonly [Stylesheets.entry]?: string | undefined
    /** Host syntax from the same immutable source snapshot. */
    readonly [Syntax.cache]?:
      | ReadonlyMap<string, Parser.ParseResult>
      | undefined
    /** Rewrite authoring calls. False emits CSS for unchanged source. */
    readonly compiler?: boolean | undefined
    /** Whether compiled applications can be combined with one another. */
    readonly composition?: Css.compile.Options['composition']
    /** Default CSS representation for definitions without an explicit mode. */
    readonly cssOutput?: Css.compile.Options['cssOutput']
    /** Serialized library contracts keyed by host-resolved module identity. Runtime modules stay external to this graph. */
    readonly contracts?: Readonly<Record<string, string>> | undefined
    /** Stable declaration names for CSS-only development updates. */
    readonly development?: boolean | undefined
    /** Host-resolved static runtime imports keyed by module ID and source specifier; null marks externals. The host owns dynamic imports when supplied. Omit for closed relative-graph resolution. */
    readonly imports?:
      | Readonly<Record<string, Readonly<Record<string, string | null>>>>
      | undefined
    /** Native output context. Omit to compile web modules and CSS. */
    readonly native?:
      | Omit<
          Native.compile.Options,
          'moduleId' | 'source' | typeof Themes.context
        >
      | undefined
    /** Complete source graph keyed by stable package-relative module identities. */
    readonly modules: Readonly<Record<string, string>>
    /** Optional reset stylesheet supplied by the host, ordered before authored layers. */
    readonly reset?: string | undefined
  }

  /** Compiled modules and their direct source dependencies. */
  type ReturnType = {
    /** Versioned compiler-only JSON per module; publish beside the compiled entrypoint as <entry>.zyzz.json. */
    readonly contracts: Readonly<Record<string, string>>
    /** Direct static runtime source and library-contract dependencies, keyed by module identity. */
    readonly dependencies: Readonly<Record<string, readonly string[]>>
    /** One eager stylesheet for all supplied modules. Load before module CSS. */
    readonly sharedCss?: string | undefined
    /** Source map for source-owned and packed global contributions. */
    readonly sharedCssMap?: Mapping.EncodedSourceMap | undefined
    /** Trusted source or contract owner for each shared asset placeholder. */
    readonly sharedAssetOwners?: Readonly<Record<string, string>> | undefined
    /** Portable asset targets keyed by emitted compiler URL placeholders. */
    readonly sharedAssets?: Readonly<Record<string, string>> | undefined
    /** Rewritten modules and their stylesheets/maps. Load the CSS for the graph together. */
    readonly modules: Readonly<Record<string, Transform.compile.ReturnType>>
  }
}

/** Creates an isolated compiler with bounded extraction reuse across source graphs. */
export function create(): create.ReturnType {
  let previous: Cache | undefined

  return Object.freeze({
    compile(options: compile.Options): compile.ReturnType {
      const next = build(options, previous)

      previous = next

      return next.result
    },
  })
}

/** Incremental graph compiler contracts. */
export declare namespace create {
  /** Explicitly owned compilation state; dropping the compiler releases its cache. */
  type ReturnType = {
    /** Compiles a complete source snapshot, reusing unaffected work across calls. */
    readonly compile: typeof compile
  }
}

type Extraction = {
  dependencies: readonly string[]
  extracted: Source.extract.ReturnType
  inputs: ReadonlyMap<
    string,
    Source.extract.ReturnType | ReturnType<typeof Contract.read>
  >
  resolution: string
  source: string
}

type Transformed = {
  classes: Readonly<Record<string, string | undefined>>
  extracted: Source.extract.ReturnType
  owners: string
  output: Transform.compile.ReturnType
  schemes: boolean
  themes: Readonly<Record<string, Theme.Definition>>
}

type Cache = {
  compiler: boolean
  composition: Css.compile.Options['composition']
  cssOutput: Css.compile.Options['cssOutput']

  contracts: string
  development: boolean
  entry: string | undefined
  extracted: ReadonlyMap<string, Source.extract.ReturnType>
  libraries: Readonly<Record<string, ReturnType<typeof Contract.read>>>
  reset: string | undefined
  retained: ReadonlyMap<string, Extraction>
  transformed: ReadonlyMap<string, Transformed>
  resolutions: Readonly<Record<string, string>>
  native: compile.Options['native']
  result: compile.ReturnType
  schemes: boolean
  sources: Readonly<Record<string, string>>
  themes: Readonly<Record<string, Theme.Definition>>
}

function build(options: compile.Options, cache?: Cache): Cache {
  if (
    !!cache?.native !== !!options.native ||
    cache?.native?.[Edits.runtime] !== options.native?.[Edits.runtime] ||
    Object.keys(cache?.native ?? {}).length !==
      Object.keys(options.native ?? {}).length ||
    Object.entries(cache?.native ?? {}).some(([key, value]) => {
      const next = Reflect.get(options.native ?? {}, key)
      if (key !== 'fonts' && key !== 'vars' && key !== 'units')
        return value !== next

      return (
        !!value !== !!next ||
        Object.keys(value ?? {}).length !== Object.keys(next ?? {}).length ||
        Object.entries(value ?? {}).some(
          ([name, entry]) => Reflect.get(next ?? {}, name) !== entry,
        )
      )
    })
  )
    cache = undefined
  if (options.native && options.reset !== undefined)
    throw new Native.CompileError(
      'The CSS reset is only supported by web builds.',
    )
  if (options.native && options.compiler === false)
    throw new Native.CompileError(
      'Native graph compilation requires source rewriting.',
    )
  if (cache?.compiler !== (options.compiler !== false)) cache = undefined
  if (cache?.reset !== options.reset) cache = undefined
  if (cache?.cssOutput !== options.cssOutput) cache = undefined
  if (cache?.composition !== options.composition) cache = undefined
  const ids = Object.keys(options.modules).sort()
  const programs = new Map<string, ReturnType<typeof Syntax.parse>>()
  function parse(input: Syntax.parse.Options) {
    const cached =
      programs.get(input.moduleId) ?? options[Syntax.cache]?.get(input.moduleId)
    if (cached) return cached
    const parsed = Syntax.parse(input)
    programs.set(input.moduleId, parsed)
    return parsed
  }

  const contracts = JSON.stringify(
    Object.entries(options.contracts ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  )

  const resolutions = Object.fromEntries(
    [...new Set([...ids, ...Object.keys(options.imports ?? {})])]
      .sort()
      .map((id) => [
        id,
        options.imports === undefined
          ? 'relative'
          : JSON.stringify(
              Object.entries(options.imports[id] ?? {}).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            ),
      ]),
  )

  // Host resolutions remain explicit when generated modules enter or leave the graph.
  const previous = (() => {
    if (
      cache &&
      cache.contracts === contracts &&
      cache.development === !!options.development &&
      (options.imports !== undefined ||
        (ids.length === Object.keys(cache.sources).length &&
          ids.every((id) => Object.hasOwn(cache.sources, id))))
    ) {
      return cache
    }

    return undefined
  })()
  if (
    previous &&
    previous.entry === options[Stylesheets.entry] &&
    ids.length === Object.keys(previous.sources).length &&
    Object.keys(resolutions).length ===
      Object.keys(previous.resolutions).length &&
    Object.entries(resolutions).every(
      ([id, value]) => value === previous.resolutions[id],
    ) &&
    ids.every(
      (id) =>
        options.modules[id] === previous.sources[id] &&
        resolutions[id] === previous.resolutions[id],
    )
  )
    return previous

  const retained = new Map(previous?.retained)
  const transformed = new Map(previous?.transformed)
  const dependencies: Record<string, readonly string[]> = Object.create(null)
  const extracted = new Map<string, Source.extract.ReturnType>()
  const identifiers = new Map<string, Set<string>>()
  const owners: Record<string, NonNullable<Themes.Context['owners']>[string]> =
    Object.create(null)
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const visiting = new Set<string>()
  const libraries: Record<
    string,
    ReturnType<typeof Contract.read>
  > = Object.create(null)
  const identities = new Map<string, Token.Contract>()
  const variableSlots = new Map<
    string,
    { owner: string; binding: string; type: string }
  >()

  function validateLibraryLink(link: Themes.Link, owner: string) {
    const variableOwner = owner.includes('/')
      ? (link.call.variableOwner ?? owner)
      : owner

    for (const slot of Object.values(link.call.variables ?? {})) {
      const previous = variableSlots.get(slot.name)
      if (
        previous &&
        (previous.owner !== variableOwner ||
          previous.binding !== link.binding ||
          previous.type !== slot.type)
      )
        throw new Error(
          `Conflicting packed variable identity: ${slot.name}; compile libraries with package-qualified module IDs.`,
        )

      variableSlots.set(slot.name, {
        owner: variableOwner,
        binding: link.binding,
        type: slot.type,
      })
    }

    for (const member of Object.values(link.members ?? {}))
      validateLibraryLink(member, owner)
  }

  for (const [id, source] of Object.entries(options.contracts ?? {})) {
    if (Object.hasOwn(options.modules, id))
      fail(id, 'A module cannot supply both source and a library contract.')

    try {
      const library =
        previous?.libraries[id] ?? Contract.read(source, identities, id)

      for (const link of Object.values(library.links))
        validateLibraryLink(link, id)

      for (const [name, theme] of Object.entries(library.themes)) {
        if (
          themes[name] &&
          Contract.write({}, { [name]: themes[name]! }) !==
            Contract.write({}, { [name]: theme })
        )
          throw new Error(`Conflicting library theme identity: ${name}`)

        themes[name] = theme
      }

      libraries[id] = library
    } catch (error) {
      fail(id, `Invalid library contract: ${(error as Error).message}`)
    }
  }

  function fail(
    moduleId: string,
    message: string,
    node?: Pick<Ast.Node, 'start' | 'end'>,
  ): never {
    throw new Source.ExtractError([
      {
        code: 'unsupported_syntax',
        end: node?.end ?? 0,
        message,
        source: moduleId,
        start: node?.start ?? 0,
      },
    ])
  }

  function resolve(
    moduleId: string,
    specifier: string,
    node: Pick<Ast.Node, 'start' | 'end'> = { start: 0, end: 0 },
  ): string | undefined {
    if (options.imports !== undefined) {
      const imports = options.imports[moduleId]

      if (!imports || !Object.hasOwn(imports, specifier))
        fail(moduleId, `Missing host resolution: ${specifier}`, node)

      const target = imports[specifier]
      if (target === null) return undefined

      if (
        target === undefined ||
        (!Object.hasOwn(options.modules, target) &&
          !Object.hasOwn(libraries, target))
      )
        fail(moduleId, `Missing host source module: ${specifier}`, node)

      return target
    }

    try {
      return Relative.resolve({ moduleId, modules: options.modules, specifier })
    } catch (error) {
      fail(moduleId, (error as Error).message, node)
    }
  }

  const constants = new Map<string, Ast.Node | undefined>()
  function constant(
    moduleId: string,
    name: string,
    active = new Set<string>(),
  ): Ast.Node | undefined {
    const key = JSON.stringify([moduleId, name])
    if (constants.has(key)) return constants.get(key)
    if (active.has(key) || !Object.hasOwn(options.modules, moduleId))
      return undefined
    const next = new Set(active).add(key)
    const program = parse({
      moduleId,
      source: options.modules[moduleId]!,
    }).program
    const imports: Record<string, Ast.Node> = Object.create(null)
    let local = name
    let exported = false
    let direct: Ast.Node | undefined
    const stars: string[] = []
    for (const statement of program.body) {
      if (statement.type === 'ExportDefaultDeclaration' && name === 'default') {
        direct = statement.declaration
        exported = true
      }
      if (
        statement.type === 'ExportAllDeclaration' &&
        statement.exportKind !== 'type' &&
        !statement.exported &&
        name !== 'default'
      ) {
        const target = resolve(moduleId, statement.source.value, statement)
        if (target) stars.push(target)
      }
      if (
        statement.type !== 'ExportNamedDeclaration' ||
        statement.exportKind === 'type'
      )
        continue
      if (statement.declaration?.type === 'VariableDeclaration')
        exported ||= statement.declaration.declarations.some(
          (value) => value.id.type === 'Identifier' && value.id.name === name,
        )
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === 'type') continue
        const alias =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        if (alias !== name) continue
        local =
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value
        if (statement.source) {
          const target = resolve(moduleId, statement.source.value, statement)
          return target ? constant(target, local, next) : undefined
        }
        exported = true
      }
    }
    if (!exported) {
      const candidates = [
        ...new Set(
          stars
            .map((target) => constant(target, name, next))
            .filter((value) => value !== undefined),
        ),
      ]
      const value = candidates.length === 1 ? candidates[0] : undefined
      if (value || !stars.length) constants.set(key, value)
      return value
    }
    if (
      direct &&
      [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
        'ClassDeclaration',
        'ClassExpression',
      ].includes(direct.type)
    ) {
      constants.set(key, undefined)
      return undefined
    }
    for (const statement of program.body) {
      if (
        statement.type === 'ImportDeclaration' &&
        statement.importKind !== 'type'
      ) {
        const target = resolve(moduleId, statement.source.value, statement)
        if (!target) continue
        for (const specifier of statement.specifiers) {
          if (
            specifier.type === 'ImportNamespaceSpecifier' ||
            (specifier.type === 'ImportSpecifier' &&
              specifier.importKind === 'type')
          )
            continue
          const imported =
            specifier.type === 'ImportDefaultSpecifier'
              ? 'default'
              : specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : specifier.imported.value
          const value = constant(target, imported, next)
          if (value) imports[specifier.local.name] = relocate(value, specifier)
        }
      }
    }
    const scope = new Scope.Tracker({ preserveExitedScopes: true })
    Walker.walk(program, { scopeTracker: scope })
    scope.freeze()
    let value: Ast.Node | undefined
    try {
      const data = Static.collect(program, scope, imports)
      value = direct
        ? data.normalize(direct, new Set(), new Set(), true)
        : data.exported(local)
    } catch {
      return undefined
    }
    if (value && !literal(value)) value = undefined
    constants.set(key, value)
    return value
  }

  function literal(node: Ast.Node, depth = 0): boolean {
    if (depth > 64) return false
    if (node.type === 'Literal')
      return (
        node.value === null ||
        ['string', 'number', 'boolean'].includes(typeof node.value)
      )
    if (node.type === 'UnaryExpression')
      return (
        ['+', '-'].includes(node.operator) &&
        node.argument.type === 'Literal' &&
        typeof node.argument.value === 'number'
      )
    if (node.type === 'TemplateLiteral') return !node.expressions.length
    if (node.type === 'ArrayExpression')
      return node.elements.every((value) => value && literal(value, depth + 1))
    return (
      node.type === 'ObjectExpression' &&
      node.properties.every(
        (property) =>
          property.type === 'Property' &&
          !property.method &&
          property.kind === 'init' &&
          (!property.computed || property.key.type === 'Literal') &&
          literal(property.value, depth + 1),
      )
    )
  }

  function relocate(
    node: Ast.Node,
    span: Pick<Ast.Node, 'start' | 'end'>,
  ): Ast.Node {
    const copy = structuredClone(node)
    Walker.walk(copy, {
      enter(node) {
        node.start = span.start
        node.end = span.end
      },
    })
    return copy
  }

  const factoryPrograms = new Map<string, Ast.Program>()
  function factory(
    moduleId: string,
    name: string,
    seen = new Set<string>(),
  ): string | undefined {
    if (moduleId === 'zyzz/web')
      return Contributions.factories.includes(name) ? name : undefined
    const key = `${moduleId}#${name}`
    if (seen.has(key) || !Object.hasOwn(options.modules, moduleId))
      return undefined
    const next = new Set(seen).add(key)
    const program =
      factoryPrograms.get(moduleId) ??
      Parser.parseSync('barrel.ts', options.modules[moduleId]!, {
        sourceType: 'module',
      }).program
    factoryPrograms.set(moduleId, program)
    const target = (specifier: string, node: Ast.Node) =>
      specifier === 'zyzz/web' ? specifier : resolve(moduleId, specifier, node)
    for (const node of program.body) {
      if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type')
        continue
      const declaration = node.declaration
      if (
        declaration?.type === 'VariableDeclaration' &&
        declaration.declarations.some(
          (item) => item.id.type === 'Identifier' && item.id.name === name,
        )
      )
        return undefined
      if (
        (declaration?.type === 'FunctionDeclaration' ||
          declaration?.type === 'ClassDeclaration') &&
        declaration.id?.name === name
      )
        return undefined
      for (const specifier of node.specifiers) {
        if (specifier.exportKind === 'type') continue
        const exported =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        if (exported !== name) continue
        const local =
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value
        if (node.source) {
          const id = target(node.source.value, node)
          return id ? factory(id, local, next) : undefined
        }
        for (const declaration of program.body) {
          if (
            declaration.type !== 'ImportDeclaration' ||
            declaration.importKind === 'type'
          )
            continue
          for (const imported of declaration.specifiers) {
            if (
              imported.type !== 'ImportSpecifier' ||
              imported.importKind === 'type' ||
              imported.local.name !== local
            )
              continue
            const id = target(declaration.source.value, declaration)
            return id
              ? factory(
                  id,
                  imported.imported.type === 'Identifier'
                    ? imported.imported.name
                    : imported.imported.value,
                  next,
                )
              : undefined
          }
        }
        return undefined
      }
    }
    for (const node of program.body) {
      if (
        node.type === 'ExportAllDeclaration' &&
        node.exportKind !== 'type' &&
        !node.exported
      ) {
        const id = target(node.source.value, node)
        const found = id ? factory(id, name, next) : undefined
        if (found) return found
      }
    }
    return undefined
  }
  function visit(moduleId: string): Source.extract.ReturnType {
    const cached = extracted.get(moduleId)
    if (cached) return cached

    if (visiting.has(moduleId))
      fail(moduleId, 'Circular source dependencies are not supported yet.')

    visiting.add(moduleId)

    const source = options.modules[moduleId]!

    const snapshot =
      previous?.retained.get(moduleId) ??
      (previous && Object.hasOwn(previous.sources, moduleId)
        ? {
            dependencies: previous.result.dependencies[moduleId]!,
            extracted: previous.extracted.get(moduleId)!,
            inputs: new Map(
              previous.result.dependencies[moduleId]!.map((target) => [
                target,
                previous.libraries[target] ?? previous.extracted.get(target)!,
              ]),
            ),
            resolution: previous.resolutions[moduleId]!,
            source: previous.sources[moduleId]!,
          }
        : undefined)
    if (
      snapshot &&
      source === snapshot.source &&
      resolutions[moduleId] === snapshot.resolution &&
      snapshot.dependencies.every((target) =>
        Object.hasOwn(libraries, target)
          ? libraries[target] === snapshot.inputs.get(target)
          : Object.hasOwn(options.modules, target) &&
            visit(target) === snapshot.inputs.get(target),
      )
    ) {
      return retain(moduleId, snapshot.extracted, snapshot.dependencies)
    }

    // Validate identity and syntax through the public source boundary before linking.
    Source.extract({ moduleId, source: '' })

    const parsed = parse({ moduleId, source })

    if (parsed.errors.length) Source.extract({ moduleId, source })
    factoryPrograms.set(moduleId, parsed.program)

    const names = new Set<string>()
    identifiers.set(moduleId, names)
    Walker.walk(parsed.program, {
      enter(node) {
        if (node.type === 'Identifier') names.add(node.name)
        if (
          options.imports === undefined &&
          node.type === 'ImportExpression' &&
          (node.source.type !== 'Literal' ||
            typeof node.source.value !== 'string' ||
            node.source.value.startsWith('.'))
        )
          fail(
            moduleId,
            'Source graph dependencies require static imports.',
            node,
          )
      },
    })

    const values: Record<string, Ast.Node> = Object.create(null)
    const links: Record<string, Themes.Link> = Object.create(null)
    const forwarded: Record<string, Themes.Link> = Object.create(null)
    const explicit = new Set<string>()
    const stars: Readonly<Record<string, Themes.Link>>[] = []
    const imports = new Set<string>()

    function exportedBindings(node: Ast.Node) {
      if (node.type === 'Identifier') explicit.add(node.name)
      else if (node.type === 'ObjectPattern')
        for (const property of node.properties)
          exportedBindings(
            property.type === 'Property' ? property.value : property.argument,
          )
      else if (node.type === 'ArrayPattern')
        for (const element of node.elements) {
          if (element) exportedBindings(element)
        }
      else if (node.type === 'AssignmentPattern') exportedBindings(node.left)
      else if (node.type === 'RestElement') exportedBindings(node.argument)
    }

    for (const node of parsed.program.body) {
      if (
        node.type === 'ExportNamedDeclaration' &&
        !node.source &&
        node.exportKind !== 'type'
      ) {
        for (const specifier of node.specifiers)
          if (specifier.exportKind !== 'type')
            explicit.add(
              specifier.exported.type === 'Identifier'
                ? specifier.exported.name
                : specifier.exported.value,
            )

        if (node.declaration?.type === 'VariableDeclaration')
          for (const declaration of node.declaration.declarations)
            exportedBindings(declaration.id)
        else if (
          (node.declaration?.type === 'FunctionDeclaration' ||
            node.declaration?.type === 'ClassDeclaration') &&
          node.declaration.id
        )
          explicit.add(node.declaration.id.name)
      }

      if (
        (node.type !== 'ImportDeclaration' &&
          node.type !== 'ExportNamedDeclaration' &&
          node.type !== 'ExportAllDeclaration') ||
        !node.source
      )
        continue

      if (
        node.type === 'ImportDeclaration'
          ? node.importKind === 'type'
          : node.exportKind === 'type'
      )
        continue

      if (
        'specifiers' in node &&
        node.specifiers.length &&
        node.specifiers.every((specifier) =>
          specifier.type === 'ImportSpecifier'
            ? specifier.importKind === 'type'
            : specifier.type === 'ExportSpecifier' &&
              specifier.exportKind === 'type',
        )
      )
        continue

      const target = resolve(moduleId, node.source.value, node)
      if (!target) continue

      imports.add(target)

      const contracts =
        libraries[target]?.links ?? visit(target).themeExports ?? {}

      function namespace(name: string): Themes.Link | undefined {
        const first = Object.values(contracts)[0]
        if (!first) return undefined
        return {
          binding: `z-style-${Identity.hash(JSON.stringify([moduleId, name]))}-namespace`,
          call: { start: -1, end: -1, name: '', tokenType: '{}' },
          definition: first.definition,
          kind: 'style-reference',
          members: contracts,
        }
      }

      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            if (
              Object.values(contracts).some(
                (link) => link.kind !== 'style-reference',
              )
            )
              fail(
                moduleId,
                'Import theme contracts by name; namespace imports are not supported.',
                specifier,
              )

            const link = namespace(specifier.local.name)
            if (link) links[specifier.local.name] = link
            continue
          }

          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type'
          )
            continue

          const name = (() => {
            if (specifier.type === 'ImportDefaultSpecifier') {
              return 'default'
            }

            if (specifier.imported.type === 'Identifier') {
              return specifier.imported.name
            }

            return specifier.imported.value
          })()

          if (Object.hasOwn(contracts, name))
            links[specifier.local.name] = contracts[name]!
          else {
            const value = constant(target, name)
            if (value) values[specifier.local.name] = relocate(value, specifier)
          }
        }
      } else if (node.type === 'ExportAllDeclaration') {
        if (node.exported) {
          if (
            Object.values(contracts).some(
              (link) => link.kind !== 'style-reference',
            )
          )
            fail(
              moduleId,
              'Namespace theme re-exports are not supported.',
              node,
            )
          const name =
            node.exported.type === 'Identifier'
              ? node.exported.name
              : node.exported.value
          explicit.add(name)
          const link = namespace(name)
          if (link) forwarded[name] = link
        } else stars.push(contracts)
      } else {
        for (const specifier of node.specifiers) {
          if (specifier.exportKind === 'type') continue

          const name =
            specifier.local.type === 'Identifier'
              ? specifier.local.name
              : specifier.local.value
          const exported =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value

          explicit.add(exported)

          if (Object.hasOwn(contracts, name))
            forwarded[exported] = contracts[name]!
        }
      }
    }
    const factories: Record<string, string> = Object.create(null)
    for (const node of parsed.program.body) {
      if (
        node.type !== 'ImportDeclaration' ||
        node.importKind === 'type' ||
        node.specifiers.every(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type',
        ) ||
        ['zyzz', 'zyzz/web'].includes(node.source.value)
      )
        continue
      const target = resolve(moduleId, node.source.value, node)
      if (!target) continue
      for (const specifier of node.specifiers) {
        if (
          specifier.type !== 'ImportSpecifier' ||
          specifier.importKind === 'type'
        )
          continue
        const name =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        const found = factory(target, name)
        if (found) factories[specifier.local.name] = found
      }
    }

    const result = Source.extract({
      target: options.native ? 'native' : 'web',
      compiler: options.compiler,
      moduleId,
      source,
      [Themes.context]: { constants: values, factories, links, parsed },
    })

    function outputLink(link: Themes.Link): Themes.Link {
      return {
        ...link,
        ...(link.style
          ? {
              style: {
                ...link.style,
                style: {
                  ...link.style.style,
                  cssOutput:
                    link.style.style.cssOutput ?? options.cssOutput ?? 'atomic',
                },
              },
            }
          : {}),
        ...(link.members
          ? {
              members: Object.fromEntries(
                Object.entries(link.members).map(([name, member]) => [
                  name,
                  outputLink(member),
                ]),
              ),
            }
          : {}),
      }
    }

    const exports: Record<string, Themes.Link> = Object.assign(
      Object.create(null),
      forwarded,
      Object.fromEntries(
        Object.entries(result.themeExports ?? {}).map(([name, link]) => [
          name,
          outputLink(link),
        ]),
      ),
    )

    for (const name of Object.keys(result.themeExports ?? {}))
      explicit.add(name)

    for (const contracts of stars)
      for (const [name, link] of Object.entries(contracts)) {
        if (name === 'default' || explicit.has(name)) continue

        const previous = exports[name]

        if (
          previous &&
          (previous.binding !== link.binding || previous.kind !== link.kind)
        )
          fail(moduleId, `Ambiguous theme re-export: ${name}`)

        exports[name] = link
      }

    const linked = Object.freeze({
      ...result,
      themeExports: Object.freeze(exports),
    })

    return retain(moduleId, linked, Object.freeze([...imports]))
  }

  function retain(
    moduleId: string,
    result: Source.extract.ReturnType,
    imports: readonly string[],
  ): Source.extract.ReturnType {
    for (const call of result.variableCalls ?? [])
      for (const slot of Object.values(call.slots)) {
        const owner = moduleId.replace(/\.[cm]?[jt]sx?$/, '')
        const previous = variableSlots.get(slot.name)

        if (
          previous &&
          (previous.owner !== owner || previous.type !== slot.type)
        )
          fail(
            moduleId,
            `Conflicting variable identity: ${slot.name}; compile libraries with package-qualified module IDs.`,
            call,
          )

        variableSlots.set(slot.name, {
          owner,
          binding: `source:${call.start}`,
          type: slot.type,
        })
      }

    extracted.set(moduleId, result)
    dependencies[moduleId] = imports
    retained.delete(moduleId)
    retained.set(moduleId, {
      dependencies: imports,
      extracted: result,
      inputs: new Map(
        imports.map((target) => [
          target,
          libraries[target] ?? extracted.get(target)!,
        ]),
      ),
      resolution: resolutions[moduleId]!,
      source: options.modules[moduleId]!,
    })
    if (retained.size > 256) retained.delete(retained.keys().next().value!)

    for (const call of result.themeCalls)
      for (const name of new Set([
        call.name,
        ...Object.values(call.members ?? {}),
      ]))
        owners[name] = {
          call: { ...call, name },
          moduleId,
          source: options.modules[moduleId]!,
        }

    Object.assign(themes, result.vars)
    visiting.delete(moduleId)

    return result
  }

  for (const moduleId of ids) visit(moduleId)

  if (options.native) {
    const native = options.native
    function packedLink(link: Themes.Link): Themes.Link {
      return {
        ...link,
        ...(link.style
          ? { style: { ...link.style, className: link.style.className ?? '' } }
          : {}),
        ...(link.members
          ? {
              members: Object.fromEntries(
                Object.entries(link.members).map(([name, link]) => [
                  name,
                  packedLink(link),
                ]),
              ),
            }
          : {}),
      }
    }
    const modules = Object.fromEntries(
      ids.map((moduleId) => {
        if (
          previous &&
          extracted.get(moduleId) === previous.extracted.get(moduleId)
        )
          return [moduleId, previous.result.modules[moduleId]!]

        const imported: Record<
          string,
          Readonly<Record<string, Themes.Link>>
        > = Object.create(null)
        for (const statement of parse({
          moduleId,
          source: options.modules[moduleId]!,
        }).program.body) {
          if (
            (statement.type !== 'ImportDeclaration' &&
              statement.type !== 'ExportNamedDeclaration' &&
              statement.type !== 'ExportAllDeclaration') ||
            !statement.source
          )
            continue
          if (
            (statement.type === 'ImportDeclaration' &&
              statement.importKind === 'type') ||
            (statement.type !== 'ImportDeclaration' &&
              statement.exportKind === 'type')
          )
            continue
          if (
            'specifiers' in statement &&
            statement.specifiers.length &&
            statement.specifiers.every((specifier) =>
              specifier.type === 'ImportSpecifier'
                ? specifier.importKind === 'type'
                : specifier.type === 'ExportSpecifier' &&
                  specifier.exportKind === 'type',
            )
          )
            continue
          const target = resolve(moduleId, statement.source.value, statement)
          if (target && libraries[target])
            imported[statement.source.value] = libraries[target].links
        }
        const output = Native.compile({
          ...native,
          moduleId,
          source: options.modules[moduleId]!,
          [Themes.context]: {
            parsed: parse({ moduleId, source: options.modules[moduleId]! }),
            identifiers: identifiers.get(moduleId),
            extracted: extracted.get(moduleId)!,
            libraries: imported,
            links: {},
          },
        })
        return [moduleId, nativeOutput(output)]
      }),
    )
    return {
      compiler: true,
      composition: options.composition,
      contracts,
      cssOutput: options.cssOutput,
      development: !!options.development,
      extracted,
      libraries: Object.freeze(libraries),
      native: {
        ...options.native,
        ...(options.native.fonts && { fonts: { ...options.native.fonts } }),
        ...(options.native.vars && { vars: { ...options.native.vars } }),
        ...(options.native.units && { units: { ...options.native.units } }),
      },
      reset: options.reset,
      entry: options[Stylesheets.entry],
      retained,
      transformed,
      resolutions: Object.freeze(resolutions),
      result: Object.freeze({
        contracts: Object.freeze(
          Object.fromEntries(
            ids
              .filter(
                (id) =>
                  Object.keys(extracted.get(id)!.themeExports ?? {}).length,
              )
              .map((id) => [
                id,
                Contract.write(
                  Object.fromEntries(
                    Object.entries(extracted.get(id)!.themeExports ?? {}).map(
                      ([name, link]) => [name, packedLink(link)],
                    ),
                  ),
                  themes,
                  [],
                  id,
                ),
              ]),
          ),
        ),
        dependencies: Object.freeze(dependencies),
        modules: Object.freeze(modules),
      }),
      schemes: false,
      sources: Object.freeze({ ...options.modules }),
      themes: Object.freeze(themes),
    }
  }

  const modules: Record<string, Transform.compile.ReturnType> =
    Object.create(null)
  const sharedThemes = Object.freeze(themes)
  const sections = new Map<string, readonly Stylesheets.Section[]>()

  for (const id of ids) {
    const extractedModule = extracted.get(id)!
    const contributions = extractedModule.contributions ?? []

    if (!contributions.length) {
      sections.set(id, [])
      continue
    }

    sections.set(
      id,
      contributions.map((contribution, index) => ({
        source: id,
        namespaces: extractedModule.namespaces,
        key: String(index),
        css:
          contribution.kind === 'layers'
            ? ''
            : (Css.compile({
                styles: { styles: [] },
                vars: sharedThemes,
                contributions: [contribution],
              }).contributionCss ?? ''),
        layers: contribution.kind === 'layers' ? [contribution.names] : [],
        content: options.modules[id]!,
        start: extractedModule.contributionStarts?.[index] ?? 0,
      })),
    )
  }

  for (const [id, library] of Object.entries(libraries))
    sections.set(
      id,
      library.stylesheets.map((section) => {
        let owner = id

        for (const specifier of section.dependency ?? []) {
          const target = resolve(owner, specifier)

          if (!target || !Object.hasOwn(libraries, target))
            fail(
              id,
              'Repacked stylesheet dependencies require supplied library contracts.',
            )

          owner = target
        }

        return {
          ...section,
          owner,
          source: Stylesheets.resolve(owner, section.source),
        }
      }),
    )

  const resetOwners = ids.filter(
    (id) =>
      options.modules[id]!.includes('zyzz/reset.css') &&
      parse({
        moduleId: id,
        source: options.modules[id]!,
      }).program.body.some(
        (node) =>
          node.type === 'ImportDeclaration' &&
          node.source.value === 'zyzz/reset.css',
      ),
  )

  const layerNames = [
    ...new Set(
      ids.flatMap((id) =>
        reachable(id).flatMap((section) => section.layers.flat()),
      ),
    ),
  ].filter((name) => name !== 'reset')

  for (const resetOwner of resetOwners) {
    const entryLayers = [
      ...new Set(
        reachable(resetOwner).flatMap((section) => section.layers.flat()),
      ),
    ].filter((name) => name !== 'reset')

    sections.set(resetOwner, [
      {
        source: resetOwner,
        key: 'optional-reset-order',
        css: '',
        layers: entryLayers.length
          ? entryLayers.map((name) => ['reset', name])
          : [['reset']],
      },
      ...(sections.get(resetOwner) ?? []),
    ])
  }

  function dependencyPath(from: string, to: string): readonly string[] {
    const queue = [{ id: from, path: [] as string[] }]
    const seen = new Set<string>()

    while (queue.length) {
      const current = queue.shift()!
      if (current.id === to) return current.path
      if (seen.has(current.id)) continue

      seen.add(current.id)

      for (const [specifier, target] of Object.entries(
        options.imports?.[current.id] ?? {},
      ))
        if (target)
          queue.push({ id: target, path: [...current.path, specifier] })
    }

    fail(
      from,
      'Repacked stylesheet ownership requires a resolved dependency path.',
    )
  }

  function reachable(
    id: string,
    visited = new Set<string>(),
  ): readonly Stylesheets.Section[] {
    if (visited.has(id)) return []

    visited.add(id)

    return [
      ...(dependencies[id] ?? []).flatMap((dependency) =>
        reachable(dependency, visited),
      ),
      ...(sections.get(id) ?? []),
    ]
  }

  const sharedVisited = new Set<string>()

  const shared = (() => {
    try {
      const entry = options[Stylesheets.entry]
      const sharedSections =
        entry === undefined
          ? ids.flatMap((id) => reachable(id, sharedVisited))
          : [
              ...(dependencies[entry] ?? [])
                .filter((id) => Object.hasOwn(libraries, id))
                .flatMap((id) => reachable(id, sharedVisited)),
              ...(sections.get(entry) ?? []),
            ]
      const resetSource =
        (options.reset === undefined ? undefined : 'zyzz/reset.css') ??
        resetOwners[0] ??
        sharedSections.find((section) => section.key === 'optional-reset-order')
          ?.source

      return Stylesheets.render([
        ...(resetSource === undefined
          ? []
          : [
              {
                source: resetSource,
                key: 'optional-reset-graph-order',
                css: '',
                layers: layerNames.length
                  ? layerNames.map((name) => ['reset', name])
                  : [['reset']],
              },
            ]),
        ...sharedSections,
        ...(options.reset === undefined
          ? []
          : [
              {
                source: 'zyzz/reset.css',
                key: 'optional-reset',
                css: options.reset,
                content: options.reset,
                layers: [['reset']],
              },
            ]),
      ])
    } catch (error) {
      return fail(
        error instanceof Stylesheets.ConflictError ? error.source : ids[0]!,
        (error as Error).message,
      )
    }
  })()

  const sharedCss = shared.css
  // Every stylesheet includes all graph scopes, including unimported alternatives.
  const names = Object.keys(themes)
  const previousNames = Object.keys(previous?.themes ?? {})

  const sameThemes =
    previous &&
    names.length === previousNames.length &&
    names.every(
      (name, index) =>
        name === previousNames[index] && previous.themes[name] === themes[name],
    )

  const styleClasses: Record<string, string> = Object.create(null)
  function published(link: Themes.Link) {
    if (link.style?.className !== undefined)
      styleClasses[link.binding] = link.style.className
    for (const member of Object.values(link.members ?? {})) published(member)
  }
  for (const library of Object.values(libraries))
    for (const link of Object.values(library.links)) published(link)

  const atomicOwners = new Map<string, string>()
  function packedOwners(link: Themes.Link, moduleId: string) {
    for (const name of link.style?.className?.split(' ') ?? []) {
      if (
        !name.startsWith('z-') ||
        name.startsWith('z-style-') ||
        name.startsWith('z-content-')
      )
        continue
      if (!atomicOwners.has(name)) atomicOwners.set(name, moduleId)
    }
    for (const member of Object.values(link.members ?? {}))
      packedOwners(member, moduleId)
  }
  for (const [moduleId, library] of Object.entries(libraries))
    for (const link of Object.values(library.links))
      packedOwners(link, moduleId)
  if (options.compiler === false) {
    const identities = new Map<string, string>()
    for (const [moduleId, library] of Object.entries(libraries)) {
      function register(name: string, signature: string) {
        const previous = identities.get(name)
        if (previous !== undefined && previous !== signature)
          fail(
            moduleId,
            'The same explicit identity is used for different definitions.',
          )
        identities.set(name, signature)
      }
      for (const [name, theme] of Object.entries(library.themes)) {
        const data = theme[Token.definition]
        if (data.contract[Token.identity]?.startsWith('id-'))
          register(`theme:${name}`, JSON.stringify(data.values))
      }
      function styles(link: Themes.Link) {
        for (const name of link.style?.className?.split(' ') ?? [])
          if (name.startsWith('z-style-id-'))
            register(name, Identity.style(link.style!.style))
        for (const member of Object.values(link.members ?? {})) styles(member)
      }
      for (const link of Object.values(library.links)) styles(link)
    }
    for (const [moduleId, module] of extracted) {
      function register(name: string, signature: string) {
        const previous = identities.get(name)
        if (previous !== undefined && previous !== signature)
          return fail(
            moduleId,
            'The same explicit identity is used for different definitions.',
          )
        identities.set(name, signature)
      }
      for (const [name, theme] of Object.entries(module.vars)) {
        const data = theme[Token.definition]
        if (data.contract[Token.identity]?.startsWith('id-'))
          register(`theme:${name}`, JSON.stringify(data.values))
      }
      for (const contribution of module.contributions ?? [])
        if ('name' in contribution)
          register(
            `${contribution.kind}:${contribution.name}`,
            Css.compile({
              styles: { styles: [] },
              contributions: [contribution],
            }).css,
          )
      for (const call of module.calls) {
        if (!call.portable?.startsWith('z-style-id-')) continue
        const signature = Identity.style(
          module.styles.styles.find((style) => style.name === call.name)!,
        )
        const previous = identities.get(call.portable)
        if (previous !== undefined && previous !== signature)
          return fail(
            moduleId,
            'The same explicit style id is used for different declarations.',
          )
        identities.set(call.portable, signature)
      }
    }
  }

  // Selection anywhere in the graph applies scheme classes beside scopes every
  // stylesheet carries, so each stylesheet declares the matching color-scheme.
  const schemes = [...extracted.values()].some((module) =>
    Boolean(
      module.themeAppearances?.length ||
      module.themeScripts?.length ||
      module.themeSelections?.length,
    ),
  )

  const ownerSignature = JSON.stringify(owners)

  // Extraction visits dependencies first; their emitted classes must precede consumers.
  for (const moduleId of extracted.keys()) {
    const cached = transformed.get(moduleId)
    const reusable =
      cached &&
      cached.extracted === extracted.get(moduleId) &&
      cached.schemes === schemes &&
      Object.keys(cached.themes).length === names.length &&
      names.every((name) => cached.themes[name] === themes[name]) &&
      Object.entries(cached.classes).every(
        ([name, value]) => styleClasses[name] === value,
      ) &&
      cached.owners === ownerSignature
    modules[moduleId] = reusable
      ? cached.output
      : sameThemes &&
          previous!.schemes === schemes &&
          extracted.get(moduleId) === previous!.extracted.get(moduleId)
        ? previous!.result.modules[moduleId]!
        : Transform.compile({
            compiler: options.compiler,
            development: options.development,
            composition: options.composition,
            cssOutput: options.cssOutput,
            moduleId,
            schemes,
            source: options.modules[moduleId]!,
            [Themes.context]: {
              parsed: parse({ moduleId, source: options.modules[moduleId]! }),
              extracted: Object.freeze({
                ...extracted.get(moduleId)!,
                vars: sharedThemes,
                contributions: undefined,
              }),
              links: {},
              owners,
              styleClasses,
            },
          })
    transformed.delete(moduleId)
    transformed.set(moduleId, {
      classes: Object.fromEntries(
        extracted
          .get(moduleId)!
          .calls.flatMap((call) =>
            (call.runtimeComposition ?? []).map((input) => [
              input.name,
              styleClasses[input.name],
            ]),
          ),
      ),
      extracted: extracted.get(moduleId)!,
      owners: ownerSignature,
      output: modules[moduleId]!,
      schemes,
      themes: sharedThemes,
    })
    if (transformed.size > 256)
      transformed.delete(transformed.keys().next().value!)
    // Module-local checks cannot detect truncated ownership hashes colliding across files.
    const emitted = new Set(
      Array.from(
        modules[moduleId]!.css.matchAll(/\.(z-[\w-]+)\{/g),
        (match) => match[1],
      ),
    )
    for (const value of Object.values(modules[moduleId]!.classes))
      for (const name of value.split(' ')) {
        if (
          options.compiler === false ||
          !name.startsWith('z-') ||
          !emitted.has(name)
        )
          continue

        const owner = atomicOwners.get(name)
        if (owner !== undefined && owner !== moduleId)
          throw new Css.CompileError([
            {
              code: 'invalid_name',
              message: `Atomic class ${name} is also owned by module ${owner}.`,
              path: [moduleId],
            },
          ])

        atomicOwners.set(name, moduleId)
      }

    for (const call of extracted.get(moduleId)!.calls)
      if (
        call.identity &&
        !call.composition &&
        !call.runtimeComposition &&
        !call.compositionCase
      )
        styleClasses[call.identity] = modules[moduleId]!.classes[call.name]!
  }

  function publishedStyle(link: Themes.Link): Themes.Link {
    return {
      ...link,
      ...(link.style
        ? {
            style: {
              ...link.style,
              className: styleClasses[link.binding] ?? link.style.className,
            },
          }
        : {}),
      ...(link.members
        ? {
            members: Object.fromEntries(
              Object.entries(link.members).map(([name, member]) => [
                name,
                publishedStyle(member),
              ]),
            ),
          }
        : {}),
    }
  }

  // A configuration whose module uses root controls or the script publishes its
  // catalog, exported or not, so initialization restores selections it persists.
  function configurations(id: string): readonly Contract.write.Configuration[] {
    const module = extracted.get(id)!

    return module.themeCalls
      .filter(
        (call) =>
          call.appearance &&
          call.options &&
          (module.themeAppearances?.includes(call.name) ||
            module.themeScripts?.includes(call.name)),
      )
      .map((call) => {
        const themeNames = call.options?.themes

        return {
          identity:
            sharedThemes[call.name]?.[Token.definition].contract[
              Token.identity
            ] ?? call.name,
          ...(typeof call.options?.storageKey === 'string'
            ? { storageKey: call.options.storageKey }
            : {}),
          themes:
            themeNames && typeof themeNames === 'object'
              ? Object.keys(themeNames)
              : [],
        }
      })
  }

  return {
    compiler: options.compiler !== false,
    composition: options.composition,
    cssOutput: options.cssOutput,
    contracts,
    development: !!options.development,
    extracted,
    libraries: Object.freeze(libraries),
    native: undefined,
    reset: options.reset,
    entry: options[Stylesheets.entry],
    retained,
    transformed,
    resolutions: Object.freeze(resolutions),
    result: Object.freeze({
      ...(sharedCss
        ? {
            sharedCss,
            sharedCssMap: shared.map,
            sharedAssets: shared.assets,
            sharedAssetOwners: shared.owners,
          }
        : {}),
      contracts: Object.freeze(
        Object.fromEntries(
          (options[Stylesheets.entry] === undefined ? ids : [])
            .filter(
              (id) =>
                Object.keys(extracted.get(id)!.themeExports ?? {}).length ||
                reachable(id).length ||
                configurations(id).length,
            )
            .map((id) => [
              id,
              Contract.write(
                Object.fromEntries(
                  Object.entries(extracted.get(id)!.themeExports ?? {}).map(
                    ([name, link]) => [name, publishedStyle(link)],
                  ),
                ),
                sharedThemes,
                reachable(id).map((section) => ({
                  ...section,
                  owner: undefined,
                  dependency:
                    section.owner && section.owner !== id
                      ? dependencyPath(id, section.owner)
                      : undefined,
                  source: Stylesheets.relative(
                    section.owner ?? id,
                    section.source,
                  ),
                })),
                id,
                configurations(id),
              ),
            ]),
        ),
      ),
      dependencies: Object.freeze(dependencies),
      modules: Object.freeze(
        Object.fromEntries(ids.map((id) => [id, modules[id]!])),
      ),
    }),
    schemes,
    sources: Object.freeze({ ...options.modules }),
    themes: sharedThemes,
  }
}

// A returned lazy map must not retain the graph compilation context.
function nativeOutput(
  output: Native.compile.ReturnType,
): Transform.compile.ReturnType {
  let sourceMap: Mapping.EncodedSourceMap | undefined

  return Object.freeze({
    classes: Object.freeze({}),
    [Edits.key]: output[Edits.key],
    code: output.code,
    css: '',
    cssMap: {
      version: 3 as const,
      names: [],
      sources: [],
      mappings: '',
    },
    get map() {
      return (sourceMap ??= JSON.parse(output.map) as Mapping.EncodedSourceMap)
    },
    vars: Object.freeze({}),
  })
}
