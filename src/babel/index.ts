/** Compiles local Zyzz authoring before Babel lowers TypeScript and JSX. @module */
import type * as Babel from '@babel/core'
import type * as Ast from '@oxc-project/types'
import * as Syntax from '../compiler/internal/Syntax.js'
import * as Themes from '../compiler/internal/Themes.js'
import * as Path from 'node:path'
import * as Trace from '@jridgewell/trace-mapping'
import * as Graph from '../compiler/Graph.js'
import * as Native from '../compiler/Native.js'
import * as NativeJsx from './NativeJsx.js'
import * as NativeEdits from './NativeEdits.js'
import * as Edits from '../compiler/internal/Edits.js'
import * as Transform from '../compiler/Transform.js'

/** Native compilation settings for one Babel transformation. */
export type NativeOptions = {
  /** Fixed build-time scheme. Omit for runtime selection through React. */
  readonly colorScheme?: 'dark' | 'light' | undefined
  /** Closed source graph supplied by the bundler for imported authoring. */
  readonly modules?: Readonly<Record<string, string>> | undefined
  /** Host-resolved graph imports. */
  readonly imports?: Graph.compile.Options['imports']
  /** Portable source identity. Defaults to a native module-local identity. */
  readonly moduleId?: string | undefined
  /** Native destination selected by the bundler. */
  readonly platform: 'android' | 'ios'
  /** Native compiler selection. Omission preserves existing native configurations. */
  readonly target?: 'native' | undefined
  /** Conversion factors for authored lengths. */
  readonly units?: Native.compile.Options['units']
}

/** Web compilation settings for one Babel transformation. */
export type WebOptions = {
  /** CSS representation. Defaults to the web compiler's atomic output. */
  readonly cssOutput?: Transform.compile.Options['cssOutput']
  /** Portable identity. Defaults to the filename relative to Babel's root. */
  readonly moduleId?: string | undefined
  /** Selects rewritten JavaScript and extracted CSS. */
  readonly target: 'web'
}

/** Explicit web or native compiler selection. */
export type Options = NativeOptions | WebOptions

/** Stylesheet artifacts stored on Babel's result.metadata.zyzz for web transforms. */
export type WebMetadata = {
  /** Extracted CSS. The consuming build must deliver this stylesheet. */
  readonly css: string
  /** CSS source map with original authoring content. */
  readonly cssMap: Transform.compile.ReturnType['cssMap']
  /** Portable identity used for class names and stylesheet ownership. */
  readonly moduleId: string
}

declare module '@babel/core' {
  interface BabelFileMetadata {
    /** Web stylesheet output owned by the consuming build. Absent on native and ordinary modules. */
    zyzz?: WebMetadata | undefined
  }
}

/** Rewrites direct Zyzz imports while preserving authored source locations. */
export function zyzz(api: typeof Babel, options: Options): Babel.PluginObj {
  const prepared = new WeakSet<Babel.types.File>()
  const callables = new WeakSet<Babel.types.Node>()
  const parsing = new WeakMap<object, Babel.TransformOptions>()
  function compile(
    file: {
      ast: Babel.types.File | { program: Ast.Program }
      code: string
      opts: Babel.TransformOptions
      metadata: Babel.BabelFile['metadata']
    },
    parsed?: ReturnType<typeof Syntax.parse>,
  ) {
    const contextual =
      options.target !== 'web' && options.colorScheme === undefined
    for (const node of file.ast.program.body) {
      if (
        node.type === 'ImportDeclaration' &&
        node.importKind !== 'type' &&
        node.source.value === 'zyzz/themes/default'
      )
        throw new Error(
          'Zyzz Babel requires local theme authoring; bundled themes require package graph support.',
        )
      if (contextual) continue
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.specifiers.every(
          (specifier) =>
            specifier.type === 'ExportSpecifier' &&
            specifier.exportKind === 'type',
        )
      )
        continue
      if (
        (node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportAllDeclaration') &&
        node.exportKind !== 'type' &&
        node.source?.value === 'zyzz'
      )
        throw new Error(
          'Zyzz Babel does not support re-exporting authoring helpers. Export compiled style definitions instead.',
        )
      if (node.type !== 'ImportDeclaration' || node.importKind === 'type')
        continue
      if (
        node.source.value === 'zyzz/themes/default' ||
        (node.source.value === 'zyzz' &&
          node.specifiers.some(
            (specifier) =>
              specifier.type === 'ImportNamespaceSpecifier' ||
              (specifier.type === 'ImportSpecifier' &&
                specifier.importKind !== 'type' &&
                (specifier.imported.type === 'Identifier'
                  ? specifier.imported.name
                  : specifier.imported.value) === 'Config'),
          ))
      )
        throw new Error(
          'Zyzz Babel currently supports literal style and variants definitions. Theme/config compilation requires the graph adapter.',
        )
    }
    const authorsStyles = file.ast.program.body.some(
      (node) =>
        node.type === 'ImportDeclaration' &&
        (node.source.value === 'zyzz' ||
          node.source.value === 'zyzz/themes/default' ||
          node.source.value === 'zyzz/web'),
    )
    if (!authorsStyles && !contextual) return
    const filename = file.opts.filename
    if (!filename)
      throw new Error('Zyzz Babel compilation requires a filename.')
    const output = (() => {
      if (options.target === 'web') {
        const moduleId =
          options.moduleId ??
          Path.relative(
            file.opts.root ?? file.opts.cwd ?? process.cwd(),
            filename,
          )
            .split(Path.sep)
            .join('/')
        const output = Transform.compile({
          cssOutput: options.cssOutput,
          moduleId,
          source: file.code,
        })
        const metadata: WebMetadata = {
          css: output.css,
          cssMap: output.cssMap,
          moduleId,
        }
        Object.assign(file.metadata, { zyzz: metadata })
        return output
      }
      if (options.target !== undefined && options.target !== 'native')
        throw new Error('Zyzz Babel target must be web or native.')
      if (options.platform !== 'ios' && options.platform !== 'android')
        throw new Error(
          'Zyzz Babel compilation requires an ios or android platform.',
        )
      if (
        !contextual &&
        options.colorScheme !== 'light' &&
        options.colorScheme !== 'dark'
      )
        throw new Error(
          'Zyzz Babel compilation requires an explicit light or dark scheme.',
        )
      if (options.modules) {
        const moduleId = options.moduleId
        if (!moduleId || !Object.hasOwn(options.modules, moduleId))
          throw new Error(
            'Native Babel graph compilation requires a moduleId present in modules.',
          )
        return Graph.compile({
          [Syntax.cache]: parsed ? new Map([[moduleId, parsed]]) : undefined,
          modules: { ...options.modules, [moduleId]: file.code },
          imports: options.imports,
          native: {
            [Edits.runtime]: true,
            platform: options.platform,
            units: options.units,
            colorScheme: options.colorScheme ?? 'light',
            contextual,
          },
        }).modules[moduleId]!
      }
      return Native.compile({
        [Themes.context]: parsed ? { parsed, links: {} } : undefined,
        [Edits.runtime]: true,
        platform: options.platform,
        units: options.units,
        colorScheme: options.colorScheme ?? 'light',
        contextual,
        moduleId: options.moduleId ?? `babel/${Path.basename(filename)}`,
        source: file.code,
      })
    })()
    return output
  }
  type Plugin = Babel.PluginObj & {
    parserOverride: (
      code: string,
      options: Babel.ParserOptions,
      parse: (code: string, options: Babel.ParserOptions) => Babel.types.File,
    ) => Babel.types.File | undefined
  }
  const plugin: Plugin = {
    name: 'zyzz',
    manipulateOptions(
      opts: Babel.TransformOptions,
      parserOpts: Babel.ParserOptions,
    ) {
      const compatible =
        options.target !== 'web' &&
        !opts.presets?.length &&
        (opts.plugins ?? []).every((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            return false
          const override = Reflect.get(entry, 'parserOverride')
          if (
            typeof override !== 'function' ||
            override === plugin.parserOverride
          )
            return true
          // Hermes delegates TypeScript files to Babel without returning a parsed tree.
          return (
            Reflect.get(entry, 'key') === 'syntax-hermes-parser' &&
            /\.tsx?$/.test(opts.filename ?? '')
          )
        })
      if (compatible) parsing.set(parserOpts, opts)
    },
    parserOverride(code, parserOpts, parse) {
      const opts = parsing.get(parserOpts)
      if (!opts) return
      try {
        const parsed = Syntax.parse({
          moduleId:
            options.moduleId ??
            `babel/${Path.basename(opts.filename ?? 'source.tsx')}`,
          source: code,
        })
        const original = parsed.errors.length
          ? parse(code, parserOpts)
          : undefined
        const output = compile(
          {
            ast: original ?? { program: parsed.program },
            code,
            opts,
            metadata: {},
          },
          parsed.errors.length ? undefined : parsed,
        )
        const edits = output?.[Edits.key]
        const ast =
          !original && edits
            ? NativeEdits.parse(api, code, parserOpts, edits, parse, callables)
            : undefined
        if (ast) {
          prepared.add(ast)
          return ast
        }
        const fallback = original ?? parse(code, parserOpts)
        if (edits) NativeEdits.apply(api, fallback, opts, edits, callables)
        prepared.add(fallback)
        return fallback
      } catch (error) {
        if (
          error instanceof Error &&
          Reflect.get(error, 'code') !== 'BABEL_PARSER_SYNTAX_ERROR'
        ) {
          error.message = `${opts.filename ?? 'unknown file'}: ${error.message}`
          if (!Reflect.get(error, 'code'))
            Object.assign(error, { code: 'BABEL_TRANSFORM_ERROR' })
        }
        throw error
      }
    },
    pre(file) {
      if (prepared.has(file.ast)) return
      const output = compile(file)
      if (!output || output.code === file.code) {
        return
      }

      const edits = output[Edits.key]
      if (edits) {
        NativeEdits.apply(api, file.ast, file.opts, edits, callables)
        file.scope.crawl()
        return
      }

      const parsed = api.parseSync(output.code, {
        babelrc: false,
        configFile: false,
        filename: file.opts.filename,
        parserOpts: file.opts.parserOpts,
      })
      if (!parsed) throw new Error('Babel did not parse the compiled module.')

      const map = new Trace.TraceMap(output.map)
      api.types.traverseFast(parsed, (node) => {
        const loc = node.loc
        if (!loc) return
        const start = Trace.originalPositionFor(map, loc.start)
        const end = Trace.originalPositionFor(map, loc.end)
        // Metro's function map requires locations for generated helpers as well as authored nodes.
        if (start.line === null || end.line === null) {
          loc.start = { ...loc.start, line: 1, column: 0 }
          loc.end = { ...loc.end, line: 1, column: 0 }
          return
        }
        loc.start = { ...loc.start, line: start.line, column: start.column }
        loc.end = { ...loc.end, line: end.line, column: end.column }
      })
      file.path.replaceWith(parsed.program)
      file.scope.crawl()
    },
    visitor:
      options.target !== 'web' && options.colorScheme === undefined
        ? NativeJsx.visitor(api, callables)
        : {},
  }
  return plugin
}
