/**
 * Links a closed graph of source modules without executing code or reading files.
 * @module
 */
import * as Css from '../web/Css.js'
import type * as Ast from '@oxc-project/types'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import type * as Theme from '../Theme.js'
import type * as Token from '../internal/Token.js'
import * as Contract from './internal/Contract.js'
import * as Relative from './internal/Relative.js'
import * as Themes from './internal/Themes.js'
import * as Source from './Source.js'
import * as Transform from './Transform.js'

/** Compiles supplied modules with shared theme contracts and dependency metadata. */
export function compile(options: compile.Options): compile.ReturnType {
  return build(options).result
}

/** Input and output of graph compilation. */
export declare namespace compile {
  /** Errors raised while extracting or compiling a source graph. */
  type ErrorType = Source.ExtractError | Transform.compile.ErrorType
  /** Source modules available for relative import resolution. */
  type Options = {
    /** Serialized library contracts keyed by host-resolved module identity. Runtime modules stay external to this graph. */
    readonly contracts?: Readonly<Record<string, string>> | undefined
    /** Host-resolved static runtime imports keyed by module ID and source specifier; null marks externals. The host owns dynamic imports when supplied. Omit for closed relative-graph resolution. */
    readonly imports?:
      | Readonly<Record<string, Readonly<Record<string, string | null>>>>
      | undefined
    /** Complete source graph keyed by stable package-relative module identities. */
    readonly modules: Readonly<Record<string, string>>
  }
  /** Compiled modules and their direct source dependencies. */
  type ReturnType = {
    /** Versioned compiler-only JSON per module; publish beside the compiled entrypoint as <entry>.zyzz.json. */
    readonly contracts: Readonly<Record<string, string>>
    /** Direct static runtime source and library-contract dependencies, keyed by module identity. */
    readonly dependencies: Readonly<Record<string, readonly string[]>>
    /** One eager stylesheet for all supplied modules. Load before module CSS. */
    readonly sharedCss?: string | undefined
    /** Rewritten modules and their stylesheets/maps. Load the CSS for the graph together. */
    readonly modules: Readonly<Record<string, Transform.compile.ReturnType>>
  }
}

/** Creates an isolated compiler that retains only the last successful graph. */
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

type Cache = {
  contracts: string
  extracted: ReadonlyMap<string, Source.extract.ReturnType>
  libraries: Readonly<Record<string, ReturnType<typeof Contract.read>>>
  resolutions: Readonly<Record<string, string>>
  result: compile.ReturnType
  sources: Readonly<Record<string, string>>
  themes: Readonly<Record<string, Theme.Definition>>
}

function build(options: compile.Options, cache?: Cache): Cache {
  const ids = Object.keys(options.modules).sort()
  const contracts = JSON.stringify(
    Object.entries(options.contracts ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  )
  const resolutions = Object.fromEntries(
    ids.map((id) => [
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
  // File-set changes can alter extensionless resolution even without source edits.
  const previous = (() => {
    if (
      cache &&
      cache.contracts === contracts &&
      ids.length === Object.keys(cache.sources).length &&
      ids.every((id) => Object.hasOwn(cache.sources, id))
    ) {
      return cache
    }
    return undefined
  })()
  if (
    previous &&
    ids.every(
      (id) =>
        options.modules[id] === previous.sources[id] &&
        resolutions[id] === previous.resolutions[id],
    )
  )
    return previous

  const dependencies: Record<string, readonly string[]> = Object.create(null)
  const extracted = new Map<string, Source.extract.ReturnType>()
  const owners: Record<string, NonNullable<Themes.Context['owners']>[string]> =
    Object.create(null)
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const visiting = new Set<string>()
  const libraries: Record<
    string,
    ReturnType<typeof Contract.read>
  > = Object.create(null)
  const identities = new Map<string, Token.Contract>()
  const markerIdentities = new Map<string, string>()
  function validateLibraryLink(link: Themes.Link) {
    if (link.call.marker) {
      const { id, schema } = link.call.marker
      const signature = JSON.stringify(
        Object.entries(schema)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, values]) => [
            key,
            [...values].sort((a, b) => String(a).localeCompare(String(b))),
          ]),
      )
      const previous = markerIdentities.get(id)
      if (previous !== undefined && previous !== signature)
        throw new Error(`Conflicting packed marker schema: ${id}`)
      markerIdentities.set(id, signature)
    }
    for (const member of Object.values(link.members ?? {}))
      validateLibraryLink(member)
  }

  for (const [id, source] of Object.entries(options.contracts ?? {})) {
    if (Object.hasOwn(options.modules, id))
      fail(id, 'A module cannot supply both source and a library contract.')
    try {
      const library =
        previous?.libraries[id] ?? Contract.read(source, identities)
      for (const link of Object.values(library.links)) validateLibraryLink(link)
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
    node: Ast.Node,
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

  function visit(moduleId: string): Source.extract.ReturnType {
    const cached = extracted.get(moduleId)
    if (cached) return cached
    if (visiting.has(moduleId))
      fail(moduleId, 'Circular source dependencies are not supported yet.')
    visiting.add(moduleId)
    const source = options.modules[moduleId]!
    if (
      previous &&
      source === previous.sources[moduleId] &&
      resolutions[moduleId] === previous.resolutions[moduleId] &&
      previous.result.dependencies[moduleId]!.every(
        (target) =>
          Object.hasOwn(libraries, target) ||
          visit(target) === previous.extracted.get(target),
      )
    ) {
      return retain(
        moduleId,
        previous.extracted.get(moduleId)!,
        previous.result.dependencies[moduleId]!,
      )
    }
    // Validate identity and syntax through the public source boundary before linking.
    Source.extract({ moduleId, source: '' })
    const parsed = Parser.parseSync('source.tsx', source, {
      sourceType: 'module',
      showSemanticErrors: true,
    })
    if (parsed.errors.length) Source.extract({ moduleId, source })
    Walker.walk(parsed.program, {
      enter(node) {
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
      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            if (Object.keys(contracts).length)
              fail(
                moduleId,
                'Import theme contracts by name; namespace imports are not supported.',
                specifier,
              )
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
        }
      } else if (node.type === 'ExportAllDeclaration') {
        if (node.exported && Object.keys(contracts).length)
          fail(moduleId, 'Namespace theme re-exports are not supported.', node)
        stars.push(contracts)
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
    const result = Source.extract({
      moduleId,
      source,
      [Themes.context]: { links },
    })
    const exports: Record<string, Themes.Link> = Object.assign(
      Object.create(null),
      forwarded,
      result.themeExports,
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
    extracted.set(moduleId, result)
    dependencies[moduleId] = imports
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
    Object.assign(themes, result.themes)
    visiting.delete(moduleId)
    return result
  }

  for (const moduleId of ids) visit(moduleId)
  const modules: Record<string, Transform.compile.ReturnType> =
    Object.create(null)
  const sharedThemes = Object.freeze(themes)
  const contributions = ids.flatMap(
    (id) => extracted.get(id)!.contributions ?? [],
  )
  const sharedCss = contributions.length
    ? Css.compile({
        styles: { styles: [] },
        themes: sharedThemes,
        contributions,
      }).css
    : ''
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
  for (const moduleId of ids)
    modules[moduleId] =
      sameThemes &&
      extracted.get(moduleId) === previous!.extracted.get(moduleId)
        ? previous!.result.modules[moduleId]!
        : Transform.compile({
            moduleId,
            source: options.modules[moduleId]!,
            [Themes.context]: {
              extracted: Object.freeze({
                ...extracted.get(moduleId)!,
                themes: sharedThemes,
                contributions: undefined,
              }),
              links: {},
              owners,
            },
          })
  return {
    contracts,
    extracted,
    libraries: Object.freeze(libraries),
    resolutions: Object.freeze(resolutions),
    result: Object.freeze({
      ...(sharedCss ? { sharedCss } : {}),
      contracts: Object.freeze(
        Object.fromEntries(
          ids
            .filter(
              (id) => Object.keys(extracted.get(id)!.themeExports ?? {}).length,
            )
            .map((id) => [
              id,
              Contract.write(
                extracted.get(id)!.themeExports ?? {},
                sharedThemes,
              ),
            ]),
        ),
      ),
      dependencies: Object.freeze(dependencies),
      modules: Object.freeze(modules),
    }),
    sources: Object.freeze({ ...options.modules }),
    themes: sharedThemes,
  }
}
