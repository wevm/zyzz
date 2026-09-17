/** Compiles local Zyzz authoring before Babel lowers TypeScript and JSX. @module */
import type * as Babel from '@babel/core'
import * as Path from 'node:path'
import * as Trace from '@jridgewell/trace-mapping'
import * as Native from '../compiler/Native.js'

/** Native compilation settings for one Babel transformation. */
export type Options = {
  /** Fixed scheme selected at build time. */
  readonly colorScheme: 'dark' | 'light'
  /** Native destination selected by the bundler. */
  readonly platform: 'android' | 'ios'
  /** Conversion factors for authored lengths. */
  readonly units?: Native.compile.Options['units']
}

/** Rewrites direct Zyzz imports while preserving authored source locations. */
export default function plugin(
  api: typeof Babel,
  options: Options,
): Babel.PluginObj {
  return {
    name: 'zyzz-native',
    pre(file) {
      for (const node of file.ast.program.body) {
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
            node.source.value === 'zyzz/themes/default'),
      )
      if (!authorsStyles) return
      if (options.platform !== 'ios' && options.platform !== 'android')
        throw new Error(
          'Zyzz Babel compilation requires an ios or android platform.',
        )
      if (options.colorScheme !== 'light' && options.colorScheme !== 'dark')
        throw new Error(
          'Zyzz Babel compilation requires an explicit light or dark scheme.',
        )

      const filename = file.opts.filename
      if (!filename)
        throw new Error('Zyzz Babel compilation requires a filename.')
      const output = Native.compile({
        ...options,
        moduleId: `babel/${Path.basename(filename)}`,
        source: file.code,
      })
      if (output.code === file.code) return

      const parsed = api.parseSync(output.code, {
        babelrc: false,
        configFile: false,
        filename,
        parserOpts: file.opts.parserOpts,
      })
      if (!parsed)
        throw new Error('Babel did not parse the compiled native module.')

      const map = new Trace.TraceMap(output.map)
      api.traverse(parsed, {
        enter(path) {
          const loc = path.node.loc
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
        },
      })
      file.path.replaceWith(parsed.program)
      file.scope.crawl()
    },
    visitor: {},
  }
}
