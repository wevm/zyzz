/** Rewrites shared static authoring to finite native table selection. @module */
import MagicString from 'magic-string'
import * as Source from './Source.js'
import * as Themes from './internal/Themes.js'
import * as StyleSheet from '../react-native/StyleSheet.js'
import * as Syntax from './internal/Syntax.js'
import * as Variants from '../react-native/Variants.js'
import * as Walker from 'oxc-walker'

/**
 * Compiles local static style and variants calls for an explicit native context.
 * @param options - Shared source, destination mappings, and selected theme/scheme.
 * @returns Native callables, source map, and complete finite recipe tables.
 * @throws {Source.ExtractError} For invalid source authoring.
 * @throws {CompileError} For native features outside the static source boundary.
 * @throws {StyleSheet.CompileError} For unsupported native declaration values.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const extracted =
    options[Themes.context]?.extracted ??
    Source.extract({
      moduleId: options.moduleId,
      source: options.source,
      target: 'native',
      [Themes.context]: options[Themes.context],
    })
  if (
    extracted.contributions?.length ||
    extracted.variableCalls?.length ||
    extracted.themeReferences.length ||
    extracted.themeSelections?.length ||
    extracted.themeAppearances?.length ||
    extracted.themeScripts?.length
  )
    throw new CompileError(
      'Native static modules do not support CSS contributions, variables, or web theme controls.',
    )
  const parsed = Syntax.parse(options)
  const names = new Set<string>()
  Walker.walk(parsed.program, {
    enter(node) {
      if (node.type === 'Identifier') names.add(node.name)
    },
  })
  let helper = '__zyzzNative'
  while (names.has(helper)) helper += '_'
  const module = new MagicString(options.source)
  const recipes: Record<string, Variants.Definition> = Object.create(null)
  for (const call of extracted.calls) {
    if (
      call.slots ||
      (call.recipe && !call.staticRecipe) ||
      call.output === 'html'
    )
      throw new CompileError(
        'Native source compilation requires static recipes without dynamic payloads, named conditions, or HTML output.',
      )
    const recipe = call.staticRecipe ?? {
      axes: {},
      defaults: {},
      rules: [
        {
          matches: [],
          value: {
            styles: extracted.styles.styles.filter(
              (style) => style.name === call.name,
            ),
          },
        },
      ],
    }
    const compiled = Variants.compile({
      recipe,
      fonts: options.fonts,
      platform: options.platform,
      themes: options.themes,
      units: options.units,
    })
    recipes[call.name] = compiled
    const styles = StyleSheet.select(compiled.styles, {
      theme: options.theme ?? 'default',
      colorScheme: options.colorScheme,
    })
    const value = `${helper}.create(${JSON.stringify({ axes: compiled.axes, defaults: compiled.defaults, styles })})`
    const axes = Object.entries(compiled.axes)
      .map(
        ([axis, choices]) =>
          `${JSON.stringify(axis)}:readonly ${JSON.stringify(choices)}`,
      )
      .join(';')
    module.overwrite(
      call.start,
      call.end,
      /\.[cm]?tsx?$/.test(options.moduleId)
        ? `(${value} as import('zyzz/runtime').Native.Callable<{${axes}}>)`
        : value,
    )
  }
  const compositions: string[] = []
  for (const statement of parsed.program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== 'zyzz' ||
      statement.importKind === 'type'
    )
      continue
    const cx = statement.specifiers.filter(
      (specifier) =>
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'cx',
    )
    if (!cx.length) continue
    compositions.push(
      ...cx.map(
        (specifier) => `const ${specifier.local.name}=${helper}.compose;`,
      ),
    )
    const kept = statement.specifiers.filter(
      (specifier) => !cx.includes(specifier),
    )
    const named = kept
      .filter((specifier) => specifier.type === 'ImportSpecifier')
      .map((specifier) => options.source.slice(specifier.start, specifier.end))
    const other = kept
      .filter((specifier) => specifier.type !== 'ImportSpecifier')
      .map((specifier) => options.source.slice(specifier.start, specifier.end))
    const imports = [
      ...other,
      ...(named.length ? [`{${named.join(',')}}`] : []),
    ]
    module.overwrite(
      statement.start,
      statement.end,
      imports.length ? `import ${imports.join(',')} from 'zyzz';` : '',
    )
  }
  if (extracted.calls.length || compositions.length) {
    let offset = options.source.startsWith('#!')
      ? options.source.indexOf('\n') + 1
      : 0

    for (const node of parsed.program.body) {
      if (node.type !== 'ExpressionStatement' || !node.directive) break

      offset = node.end
    }

    module.appendLeft(
      offset,
      `\nimport {Native as ${helper}} from 'zyzz/runtime';\n${compositions.join('\n')}\n`,
    )
  }
  return {
    code: module.toString(),
    map: module
      .generateMap({
        hires: true,
        includeContent: true,
        source: options.moduleId,
      })
      .toString(),
    recipes: Object.freeze(recipes),
  }
}

/** Native source compilation contracts. */
export declare namespace compile {
  /** Explicit source and native context, independent of device state. */
  type Options = Omit<StyleSheet.compile.Options, 'styles'> & {
    /** Compiler-owned graph context. */
    readonly [Themes.context]?: Themes.Context | undefined
    /** Scheme compiled into this module's callables. Recompile to select another scheme. */
    readonly colorScheme: StyleSheet.ColorScheme
    /** Stable source identity, including the TypeScript or JavaScript extension. */
    readonly moduleId: string
    /** Shared local style and variants authoring. */
    readonly source: string
    /** Label selected from supplied themes. Defaults to the token-fallback default table. */
    readonly theme?: string | undefined
  }
  /** Executable source with immutable recipe tables and authored source mappings. */
  type ReturnType = {
    /** Rewritten TypeScript or JavaScript preserving original exports. */
    readonly code: string
    /** Version-three source map encoded as JSON. */
    readonly map: string
    /** All theme/scheme tables for each extracted definition. */
    readonly recipes: Readonly<Record<string, Variants.Definition>>
  }
}

/** An unsupported native source feature. */
export class CompileError extends Error {
  /** Stable namespaced diagnostic name. */
  override name = 'Native.CompileError'
}
