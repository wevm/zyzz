/** Rewrites shared authoring to native tables and ordered runtime bindings. @module */
import type * as Ast from '@oxc-project/types'
import MagicString from 'magic-string'
import type * as Recipe from '../internal/Recipe.js'
import * as Source from './Source.js'
import * as NativeBindings from './internal/NativeBindings.js'
import * as Themes from './internal/Themes.js'
import * as StyleSheet from '../react-native/StyleSheet.js'
import * as Syntax from './internal/Syntax.js'
import * as Variants from '../react-native/Variants.js'
import * as Walker from 'oxc-walker'

/**
 * Compiles local style and variants calls for an explicit native context.
 * @param options - Shared source, destination mappings, and selected theme/scheme.
 * @returns Native callables, source map, and static recipe tables.
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
    (!options.contextual &&
      (extracted.themeAppearances?.length || extracted.themeScripts?.length))
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
  while (
    [helper, `${helper}Context`, `${helper}Dynamic`].some((name) =>
      names.has(name),
    )
  )
    helper += '_'
  let dynamicHelper = `${helper}Dynamic`
  while (names.has(dynamicHelper)) dynamicHelper += '_'
  const module = new MagicString(options.source)
  const recipes: Record<string, Variants.Definition> = Object.create(null)
  let dynamic = false
  const stylesByName = new Map<
    string,
    (typeof extracted.styles.styles)[number][]
  >()
  for (const style of extracted.styles.styles) {
    const styles = stylesByName.get(style.name)
    if (styles) styles.push(style)
    else stylesByName.set(style.name, [style])
  }

  for (const call of extracted.calls) {
    if (
      (call.recipe && !call.staticRecipe && !call.dynamicRecipe) ||
      call.output === 'html'
    )
      throw new CompileError(
        'Native source compilation does not support named conditions or HTML output.',
      )
    const recipe = call.staticRecipe ??
      call.dynamicRecipe ?? {
        axes: {},
        defaults: {},
        rules: [
          {
            matches: [],
            value: {
              styles: stylesByName.get(call.name) ?? [],
            },
          },
        ],
      }
    module.overwrite(call.start, call.end, callable(recipe, call.name, call))
  }

  function callable(
    recipe: Recipe.Definition,
    name: string,
    call?: Pick<
      Source.Call,
      'slots' | 'recipe' | 'valuesType' | 'recipeTypes' | 'nativeContext'
    >,
    contextOptions = options,
    compiled?: Variants.Definition,
  ): string {
    if (contextOptions.contextual) {
      const themes = call?.nativeContext?.themes ?? contextOptions.themes
      if (!call?.slots && !call?.recipe?.payloads?.length)
        compiled = Variants.compile({
          recipe,
          fonts: contextOptions.fonts,
          platform: contextOptions.platform,
          themes,
          units: contextOptions.units,
        })
      const defaultTheme =
        call?.nativeContext?.defaultTheme ?? contextOptions.theme ?? 'default'
      const alternatives = (themes ? Object.keys(themes) : ['default']).map(
        (theme) => {
          const schemes = (['light', 'dark'] as const).map(
            (colorScheme) =>
              `${JSON.stringify(colorScheme)}:${callable(recipe, name, call, { ...contextOptions, contextual: false, themes, theme, colorScheme }, compiled)}`,
          )
          return `${JSON.stringify(theme)}:{${schemes.join(',')}}`
        },
      )
      return `${helper}Context.create({${alternatives.join(',')}},${JSON.stringify(defaultTheme)})`
    }
    if (call?.slots || call?.recipe?.payloads?.length) {
      dynamic = true
      const compiled = (() => {
        try {
          return NativeBindings.compile(recipe, call, contextOptions)
        } catch (error) {
          if (error instanceof StyleSheet.CompileError) throw error
          throw new CompileError((error as Error).message)
        }
      })()
      const value = `${dynamicHelper}.create(${JSON.stringify(compiled)})`
      let input = call.valuesType ?? '{}'
      if (call.recipe) {
        input = `{${Object.entries(recipe.axes)
          .map(([axis, choices]) => {
            const types = choices.map((choice) =>
              call.recipeTypes?.[axis]?.[choice]
                ? `{${JSON.stringify(choice)}:${call.recipeTypes[axis]![choice]}}`
                : choice === 'true' || choice === 'false'
                  ? choice
                  : JSON.stringify(choice),
            )
            return `${JSON.stringify(axis)}?:${types.join('|')}|null|undefined`
          })
          .join(';')}}`
      }
      return /\.[cm]?tsx?$/.test(options.moduleId)
        ? `(${value} as import('zyzz/runtime').NativeDynamic.${call.recipe ? 'RecipeCallable' : 'Callable'}<${input}>)`
        : value
    }
    compiled ??= Variants.compile({
      recipe,
      fonts: contextOptions.fonts,
      platform: contextOptions.platform,
      themes: contextOptions.themes,
      units: contextOptions.units,
    })
    recipes[name] = compiled
    const styles = StyleSheet.select(compiled.styles, {
      theme: contextOptions.theme ?? 'default',
      colorScheme: contextOptions.colorScheme,
    })
    const value = `${helper}.create(${JSON.stringify({ axes: compiled.axes, defaults: compiled.defaults, styles })})`
    const axes = Object.entries(compiled.axes)
      .map(
        ([axis, choices]) =>
          `${JSON.stringify(axis)}:readonly ${JSON.stringify(choices)}`,
      )
      .join(';')
    return /\.[cm]?tsx?$/.test(options.moduleId)
      ? `(${value} as import('zyzz/runtime').Native.Callable<{${axes}}>)`
      : value
  }

  const packed: string[] = []
  const explicit = new Set<string>()
  function binding(node: Ast.Node) {
    if (node.type === 'Identifier') explicit.add(node.name)
    else if (node.type === 'ObjectPattern')
      for (const property of node.properties)
        binding(
          property.type === 'RestElement' ? property.argument : property.value,
        )
    else if (node.type === 'ArrayPattern')
      for (const element of node.elements) {
        if (element) binding(element)
      }
    else if (node.type === 'AssignmentPattern') binding(node.left)
    else if (node.type === 'RestElement') binding(node.argument)
  }
  for (const statement of parsed.program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.exportKind === 'type'
    )
      continue
    for (const specifier of statement.specifiers)
      if (specifier.exportKind !== 'type')
        explicit.add(
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value,
        )
    const declaration = statement.declaration
    if (declaration?.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) binding(item.id)
    } else if (
      declaration &&
      'id' in declaration &&
      declaration.id?.type === 'Identifier'
    )
      explicit.add(declaration.id.name)
  }
  for (const statement of parsed.program.body) {
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
    const specifier = statement.source.value
    const exports = options[Themes.context]?.libraries?.[specifier]
    if (!exports) continue

    let imported: string | undefined
    function original(): string {
      if (imported) return imported
      imported = `${helper}Namespace${packed.length}`
      while (names.has(imported)) imported += '_'
      names.add(imported)
      packed.push(`import * as ${imported} from ${JSON.stringify(specifier)};`)
      return imported
    }

    function overlay(original: string, expression: string): string {
      let overrides = `${helper}Members${packed.length}`
      while (names.has(overrides)) overrides += '_'
      names.add(overrides)
      packed.push(`const ${overrides}=${expression};`)
      // Getter descriptors retain live bindings outside the recipe contract.
      return `Object.freeze(Object.defineProperties({...${original},...${overrides}},Object.fromEntries(Object.keys(${original}).filter(key=>!Object.hasOwn(${overrides},key)).map(key=>[key,{get:()=>Reflect.get(${original},key)}]))))`
    }

    function value(
      name: string,
      link = exports![name],
      input?: string,
      path: readonly string[] = [name],
    ): string | undefined {
      if (!link || link.kind !== 'style-reference') return undefined
      if (link.members) {
        const source = input ?? `${original()}[${JSON.stringify(name)}]`
        const expression = `{${Object.entries(link.members)
          .map(
            ([member, link]) =>
              `[${JSON.stringify(member)}]:${value(`${name}.${member}`, link, `${source}[${JSON.stringify(member)}]`, [...path, member])}`,
          )
          .join(',')}}`
        return overlay(source, expression)
      }
      const recipe = link.style?.staticRecipe ?? link.style?.dynamic?.recipe
      if (
        !recipe ||
        link.style?.output ||
        (link.style?.slots.length && !link.style.dynamic)
      )
        throw new CompileError(
          `Packed native callable ${name} requires a static recipe contract.`,
        )
      const expression = callable(
        recipe,
        `${specifier}:${name}`,
        link.style?.dynamic
          ? {
              slots: link.style.dynamic.slots,
              recipe: {
                axes: recipe.axes,
                defaults: recipe.defaults,
                payloads: link.style.dynamic.payloads,
                defaultPayloads: link.style.dynamic.defaultPayloads,
              },
            }
          : undefined,
      )
      if (!link.style?.dynamic || !/\.[cm]?tsx?$/.test(options.moduleId))
        return expression
      const type = `typeof import(${JSON.stringify(specifier)})${path
        .map((part) => `[${JSON.stringify(part)}]`)
        .join('')}`
      return `(${expression} as import('zyzz/runtime').NativeDynamic.From<${type}>)`
    }

    function namespace(): string | undefined {
      if (
        !Object.values(exports!).some((link) => link.kind === 'style-reference')
      )
        return undefined
      const imported = original()
      const members = Object.keys(exports!).flatMap((name) => {
        const expression = value(
          name,
          exports![name],
          `${imported}[${JSON.stringify(name)}]`,
        )
        return expression === undefined
          ? []
          : [`[${JSON.stringify(name)}]:${expression}`]
      })
      return overlay(imported, `{${members.join(',')}}`)
    }

    if (statement.type === 'ExportAllDeclaration') {
      if (statement.exported) {
        const expression = namespace()
        if (expression === undefined) continue
        let local = `${helper}Export${packed.length}`
        while (names.has(local)) local += '_'
        names.add(local)
        const name =
          statement.exported.type === 'Identifier'
            ? statement.exported.name
            : statement.exported.value
        packed.push(
          `const ${local}=${expression};export {${local} as ${JSON.stringify(name)}};`,
        )
        module.overwrite(statement.start, statement.end, '')
        continue
      }
      for (const name of Object.keys(exports)) {
        if (name === 'default' || explicit.has(name)) continue
        const expression = value(name)
        if (expression === undefined) continue
        explicit.add(name)
        let local = `${helper}Export${packed.length}`
        while (names.has(local)) local += '_'
        names.add(local)
        packed.push(
          `const ${local}=${expression};export {${local} as ${JSON.stringify(name)}};`,
        )
      }
      continue
    }
    const kept: string[] = []
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportNamespaceSpecifier') {
        const expression = namespace()
        if (expression === undefined) {
          packed.push(
            `import * as ${specifier.local.name} from ${JSON.stringify(statement.source.value)};`,
          )
        } else packed.push(`const ${specifier.local.name}=${expression};`)
        continue
      }
      if (
        (specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type') ||
        (specifier.type === 'ExportSpecifier' &&
          specifier.exportKind === 'type')
      ) {
        kept.push(options.source.slice(specifier.start, specifier.end))
        continue
      }
      const imported =
        specifier.type === 'ImportDefaultSpecifier'
          ? 'default'
          : specifier.type === 'ImportSpecifier'
            ? specifier.imported
            : specifier.local
      const name =
        typeof imported === 'string'
          ? imported
          : imported.type === 'Identifier'
            ? imported.name
            : imported.value
      const expression = value(name)
      if (expression === undefined) {
        if (specifier.type === 'ImportDefaultSpecifier')
          kept.push(`default as ${specifier.local.name}`)
        else kept.push(options.source.slice(specifier.start, specifier.end))
        continue
      }
      if (specifier.type === 'ExportSpecifier') {
        let local = `${helper}Export${packed.length}`
        while (names.has(local)) local += '_'
        names.add(local)
        const exported =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        packed.push(
          `const ${local}=${expression};export {${local} as ${JSON.stringify(exported)}};`,
        )
      } else packed.push(`const ${specifier.local.name}=${expression};`)
    }
    const keyword = statement.type === 'ImportDeclaration' ? 'import' : 'export'
    module.overwrite(
      statement.start,
      statement.end,
      kept.length
        ? `${keyword} {${kept.join(',')}} from ${JSON.stringify(statement.source.value)};`
        : `import ${JSON.stringify(statement.source.value)};`,
    )
  }
  const compositions: string[] = []
  for (const statement of parsed.program.body) {
    if (
      statement.type === 'ExportAllDeclaration' &&
      statement.source.value === 'zyzz' &&
      statement.exportKind !== 'type'
    )
      throw new CompileError(
        'Native modules require named re-exports from zyzz.',
      )
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.source?.value === 'zyzz' &&
      statement.exportKind !== 'type'
    ) {
      const cx = statement.specifiers.filter(
        (specifier) =>
          specifier.exportKind !== 'type' &&
          (specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value) === 'cx',
      )
      if (!cx.length) continue
      let binding = `${helper}Compose`
      while (names.has(binding)) binding += '_'
      names.add(binding)
      compositions.push(`const ${binding}=${helper}.compose;`)
      const kept = statement.specifiers
        .filter((specifier) => !cx.includes(specifier))
        .map((specifier) =>
          options.source.slice(specifier.start, specifier.end),
        )
      const exports = cx.map(
        (specifier) =>
          `${binding} as ${options.source.slice(specifier.exported.start, specifier.exported.end)}`,
      )
      module.overwrite(
        statement.start,
        statement.end,
        `${kept.length ? `export {${kept.join(',')}} from 'zyzz';` : ''}export {${exports.join(',')}};`,
      )
      continue
    }
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
  if (extracted.calls.length || compositions.length || packed.length) {
    let offset = options.source.startsWith('#!')
      ? options.source.indexOf('\n') + 1
      : 0

    for (const node of parsed.program.body) {
      if (node.type !== 'ExpressionStatement' || !node.directive) break

      offset = node.end
    }

    module.appendLeft(
      offset,
      `\nimport {Native as ${helper}${dynamic ? `,NativeDynamic as ${dynamicHelper}` : ''}${options.contextual ? `,NativeContext as ${helper}Context` : ''}} from 'zyzz/runtime';\n${[...compositions, ...packed].join('\n')}\n`,
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
  /** Failures during extraction, table compilation, or explicit context selection. */
  type ErrorType =
    | Source.ExtractError
    | CompileError
    | StyleSheet.CompileError
    | StyleSheet.SelectionError
    | Variants.CompileError

  /** Explicit source and native context, independent of device state. */
  type Options = Omit<StyleSheet.compile.Options, 'styles'> & {
    /** Compiler-owned graph context. */
    readonly [Themes.context]?: Themes.Context | undefined
    /** Retain every theme and scheme for render-local selection. */
    readonly contextual?: boolean | undefined
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
