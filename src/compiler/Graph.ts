/**
 * Links a closed graph of source modules without executing code or reading files.
 * @module
 */
import type * as Ast from '@oxc-project/types'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import type * as Theme from '../Theme.js'
import * as Themes from './internal/Themes.js'
import * as Source from './Source.js'
import * as Transform from './Transform.js'

/** Compiles supplied modules with shared theme contracts and dependency metadata. */
export function compile(options: compile.Options): compile.ReturnType {
  const dependencies: Record<string, readonly string[]> = Object.create(null)
  const extracted = new Map<string, Source.extract.ReturnType>()
  const owners: Record<string, NonNullable<Themes.Context['owners']>[string]> =
    Object.create(null)
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const visiting = new Set<string>()

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
    if (!specifier.startsWith('.')) return undefined
    if (/\.[a-z0-9]+$/i.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier))
      return undefined
    const parts = moduleId.split('/').slice(0, -1)
    for (const part of specifier.split('/')) {
      if (part === '.' || !part) continue
      if (part === '..') {
        if (!parts.length)
          fail(moduleId, 'Source import escapes the supplied graph.', node)
        parts.pop()
      } else parts.push(part)
    }
    const path = parts.join('/')
    if (Object.hasOwn(options.modules, path)) return path
    const candidates = /\.[cm]?jsx?$/.test(path)
      ? [
          path.replace(/\.js$/, '.ts'),
          path.replace(/\.js$/, '.tsx'),
          path.replace(/\.jsx$/, '.tsx'),
          path.replace(/\.mjs$/, '.mts'),
          path.replace(/\.cjs$/, '.cts'),
        ]
      : !/\.[^/]+$/.test(path)
        ? [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '/index.ts',
            '/index.tsx',
            '/index.js',
            '/index.jsx',
          ].map((extension) => path + extension)
        : []
    const matches = [...new Set(candidates)].filter((candidate) =>
      Object.hasOwn(options.modules, candidate),
    )
    if (matches.length !== 1)
      fail(
        moduleId,
        matches.length
          ? `Ambiguous source import: ${specifier}`
          : `Missing source module: ${specifier}`,
        node,
      )
    return matches[0]!
  }

  function visit(moduleId: string): Source.extract.ReturnType {
    const cached = extracted.get(moduleId)
    if (cached) return cached
    if (visiting.has(moduleId))
      fail(moduleId, 'Circular source dependencies are not supported yet.')
    visiting.add(moduleId)
    const source = options.modules[moduleId]!
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
      const contracts = visit(target).themeExports ?? {}
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
          const name =
            specifier.type === 'ImportDefaultSpecifier'
              ? 'default'
              : specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : specifier.imported.value
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
    extracted.set(moduleId, linked)
    dependencies[moduleId] = Object.freeze([...imports])
    for (const call of result.themeCalls)
      owners[call.name] = { call, moduleId, source }
    Object.assign(themes, result.themes)
    visiting.delete(moduleId)
    return linked
  }

  for (const moduleId of Object.keys(options.modules).sort()) visit(moduleId)
  const modules: Record<string, Transform.compile.ReturnType> =
    Object.create(null)
  const sharedThemes = Object.freeze(themes)
  for (const moduleId of Object.keys(options.modules).sort())
    modules[moduleId] = Transform.compile({
      moduleId,
      source: options.modules[moduleId]!,
      [Themes.context]: {
        extracted: Object.freeze({
          ...extracted.get(moduleId)!,
          themes: sharedThemes,
        }),
        links: {},
        owners,
      },
    })
  return Object.freeze({
    dependencies: Object.freeze(dependencies),
    modules: Object.freeze(modules),
  })
}

/** Input and output of graph compilation. */
export declare namespace compile {
  type ErrorType = Source.ExtractError | Transform.compile.ErrorType
  type Options = {
    /** Complete source graph keyed by stable package-relative module identities. */
    readonly modules: Readonly<Record<string, string>>
  }
  type ReturnType = {
    /** Direct runtime source dependencies, keyed by module identity. */
    readonly dependencies: Readonly<Record<string, readonly string[]>>
    /** Rewritten modules and their stylesheets/maps. Load the CSS for the graph together. */
    readonly modules: Readonly<Record<string, Transform.compile.ReturnType>>
  }
}
