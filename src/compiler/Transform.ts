/**
 * Rewrites extracted style calls into executable modules with CSS and source maps.
 * @module
 */
import * as Expression from './internal/Expression.js'
import * as Mapping from '@jridgewell/gen-mapping'
import type * as Ast from '@oxc-project/types'
import MagicString from 'magic-string'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import * as Css from '../web/Css.js'
import type * as Style from '../Style.js'
import * as Source from './Source.js'
import * as Themes from './internal/Themes.js'

/**
 * Rewrites literal web styles and local themes without evaluation or file access.
 * Direct no-argument applications become props; other definitions become callables.
 * CSS retains ordered composition and receives module-scoped class identities.
 * @param options - Source text and a stable package-relative module identity.
 * @returns Rewritten TypeScript/JSX and CSS with separate version-three maps.
 * @throws {Source.ExtractError} If the source is outside the supported literal subset.
 * @throws {Css.CompileError} If literal CSS compilation fails.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const extracted =
    options[Themes.context]?.extracted ?? Source.extract(options)
  const emitted = Css.compile({
    styles: extracted.styles,
    contributions: extracted.contributions,
    themes: Object.keys(extracted.themes).length ? extracted.themes : undefined,
  })
  const module = new MagicString(options.source)
  const program = Parser.parseSync('source.tsx', options.source, {
    preserveParens: false,
    sourceType: 'module',
  }).program

  for (const call of extracted.contributionCalls ?? [])
    module.overwrite(
      call.start,
      call.end,
      call.kind === 'keyframes' ? JSON.stringify(call.name) : 'void 0',
    )
  type Span = Pick<Ast.Node, 'end' | 'start'>
  const applications = new Map<number, { end: number; folded: boolean }>()
  const calls = new Map(extracted.calls.map((call) => [call.start, call]))
  const definitions = new Map<number, Ast.ObjectExpression>()
  const identifiers = new Map<string, Span[]>()

  Walker.walk(program, {
    enter(node, parent) {
      if (node.type === 'Identifier') {
        const references = identifiers.get(node.name) ?? []
        references.push(node)
        identifiers.set(node.name, references)
      }

      if (node.type !== 'CallExpression') return
      const call = calls.get(node.start)
      if (!call || node.end !== call.end) return

      const folded =
        !call.slots &&
        parent?.type === 'CallExpression' &&
        parent.callee === node &&
        !parent.optional &&
        parent.arguments.length === 0
      applications.set(call.start, {
        end: folded ? parent.end : call.end,
        folded,
      })

      let argument = node.arguments[0]
      while (
        argument?.type === 'TSAsExpression' ||
        argument?.type === 'TSSatisfiesExpression'
      )
        argument = argument.expression
      if (argument?.type === 'ArrowFunctionExpression')
        argument = Expression.unwrap(argument.body) as Ast.Expression
      if (argument?.type === 'ObjectExpression')
        definitions.set(call.start, argument)
    },
  })

  let runtime = '__zyzzProps'
  while (identifiers.has(runtime)) runtime += '_'

  let variables = '__zyzzVars'
  while (identifiers.has(variables)) variables += '_'

  for (const call of extracted.variableCalls ?? [])
    module.overwrite(
      call.start,
      call.end,
      `${variables}.create(${JSON.stringify(call.slots)})`,
    )
  const first = extracted.calls[0]
  const scope = first ? first.name.slice(6, first.name.lastIndexOf('-')) : ''
  const names = new Map<string, string>()
  for (const classes of Object.values(emitted.classes))
    for (const name of classes.split(' ').filter(Boolean))
      names.set(
        name,
        name.startsWith('z_base') ? `z-${scope}-${name.slice(2)}` : name,
      )

  const classes = Object.freeze(
    Object.fromEntries(
      Object.entries(emitted.classes).map(([name, value]) => [
        name,
        value
          .split(' ')
          .filter(Boolean)
          .map((part) => names.get(part)!)
          .join(' '),
      ]),
    ),
  )

  let dynamicRuntime = '__zyzzDynamic'
  while (identifiers.has(dynamicRuntime)) dynamicRuntime += '_'
  let dynamicCallable = false
  let callable = false
  for (const call of extracted.calls) {
    const application = applications.get(call.start)!
    const props = `{className:${JSON.stringify(classes[call.name])}}`
    const replacement = (() => {
      if (call.slots) {
        const value = `${dynamicRuntime}.create({...${props},slots:${JSON.stringify(call.slots)}})`
        return /\.[cm]?tsx?$/.test(options.moduleId)
          ? `(${value} as import('zyzz').css.Dynamic<${call.valuesType}>)`
          : value
      }
      if (application.folded) return `(${props})`
      return `${runtime}.create(${props})`
    })()
    module.overwrite(call.start, application.end, replacement)
    if (call.slots) dynamicCallable = true
    else if (!application.folded) callable = true
  }

  for (const call of extracted.themeCalls) {
    const scope = (name: string) => ({ className: emitted.themes[name] })
    const props = (() => {
      if (!call.members)
        return `{className:${JSON.stringify(emitted.themes[call.name])}}`
      if (Object.hasOwn(call.members, '["theme"]'))
        return JSON.stringify({ theme: scope(call.members['["theme"]']!) })
      if (!Object.keys(call.members).length) return JSON.stringify({})
      return JSON.stringify({
        themes: Object.fromEntries(
          Object.entries(call.members).map(([key, name]) => [
            (JSON.parse(key) as readonly string[])[1]!,
            scope(name),
          ]),
        ),
      })
    })()
    const assertion = /\.[cm]?tsx?$/.test(options.moduleId)
      ? ` as ${call.type ?? `import('zyzz').Theme.Definition<${call.tokenType}>`}`
      : ''
    module.overwrite(call.start, call.end, `(${props}${assertion})`)
  }
  for (const alias of extracted.themeAliases) {
    if (alias.retained) {
      if (/\.[cm]?tsx?$/.test(options.moduleId))
        module.overwrite(
          alias.start,
          alias.end,
          `(${options.source.slice(alias.start, alias.end)} as ${alias.type ?? `import('zyzz').Theme.Definition<${alias.tokenType}>`})`,
        )
      continue
    }
    const value = alias.destructured ? '{css:undefined}' : 'undefined'
    const type =
      alias.type ?? `import('zyzz').Theme.Definition<${alias.tokenType}>`
    const assertion = /\.[cm]?tsx?$/.test(options.moduleId)
      ? ` as unknown as ${alias.destructured ? `{readonly css:${type}['css']}` : `${type}['css']`}`
      : ''
    module.overwrite(alias.start, alias.end, `(${value}${assertion})`)
  }
  for (const reference of extracted.themeReferences)
    module.overwrite(
      reference.start,
      reference.end,
      JSON.stringify(emitted.themes[reference.name]),
    )

  const replacements = [
    ...extracted.calls.map((call) => ({
      end: applications.get(call.start)!.end,
      start: call.start,
    })),
    ...(extracted.contributionCalls ?? []),
    ...(extracted.variableCalls ?? []),
    ...extracted.themeAliases,
    ...extracted.themeCalls,
    ...extracted.themeReferences,
  ].sort((a, b) => a.start - b.start)

  function replaced(reference: Span) {
    let low = 0
    let high = replacements.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (replacements[middle]!.start <= reference.start) low = middle + 1
      else high = middle
    }

    const call = replacements[low - 1]
    return call !== undefined && reference.end <= call.end
  }

  for (const node of program.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      !['zyzz', 'zyzz/web'].includes(node.source.value)
    )
      continue
    const removed = new Set<Ast.ImportDeclaration['specifiers'][number]>()
    for (const specifier of node.specifiers) {
      if (
        node.importKind === 'type' ||
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type' ||
        !(
          node.source.value === 'zyzz'
            ? ['Config', 'css', 'Theme', 'Vars']
            : ['global', 'fontFace', 'keyframes', 'layers']
        ).includes(
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value,
        )
      )
        continue

      // Conservative retention also protects type queries and shadowed references.
      const remaining = identifiers
        .get(specifier.local.name)
        ?.some(
          (reference) =>
            !(reference.start >= node.start && reference.end <= node.end) &&
            !replaced(reference),
        )
      if (!remaining) removed.add(specifier)
    }

    if (!removed.size) continue

    const retained = node.specifiers.filter(
      (specifier) => !removed.has(specifier),
    )
    if (!retained.length) module.remove(node.start, node.end)
    else if (
      retained.every((specifier) => specifier.type !== 'ImportSpecifier')
    ) {
      module.overwrite(
        node.start,
        node.source.start,
        `import ${retained.map((specifier) => options.source.slice(specifier.start, specifier.end)).join(', ')} from `,
      )
    } else {
      // Preserve the import source, attributes, and untouched specifier spelling.
      for (let index = 0; index < node.specifiers.length; index++) {
        const specifier = node.specifiers[index]!
        if (!removed.has(specifier)) continue

        const next = node.specifiers[index + 1]
        const previous = node.specifiers[index - 1]
        if (next) module.remove(specifier.start, next.start)
        else if (previous) module.remove(previous.end, specifier.end)
      }
    }
  }

  if (callable || dynamicCallable || extracted.variableCalls?.length) {
    // Insertion after a hashbang keeps executable module syntax intact.
    let offset = options.source.startsWith('#!')
      ? options.source.indexOf('\n') + 1
      : 0
    for (const node of program.body) {
      if (node.type !== 'ExpressionStatement' || !node.directive) break
      offset = node.end
    }

    module.appendLeft(
      offset,
      `\nimport { ${[callable ? `Props as ${runtime}` : '', dynamicCallable ? `Dynamic as ${dynamicRuntime}` : '', extracted.variableCalls?.length ? `Vars as ${variables}` : ''].filter(Boolean).join(', ')} } from 'zyzz/runtime';\n`,
    )
  }

  const cssMap = new Mapping.GenMapping({ file: `${options.moduleId}.css` })
  Mapping.setSourceContent(cssMap, options.moduleId, options.source)

  const lines = [0]
  for (let index = 0; index < options.source.length; index++)
    if (options.source[index] === '\n') lines.push(index + 1)

  function position(offset: number) {
    let low = 0
    let high = lines.length
    while (low + 1 < high) {
      const middle = (low + high) >>> 1
      if (lines[middle]! <= offset) low = middle
      else high = middle
    }

    return { column: offset - lines[low]!, line: low + 1 }
  }

  const owners = new Map<string, Source.Call>()
  for (const call of extracted.calls)
    for (const name of emitted.classes[call.name]!.split(' '))
      if (!owners.has(name)) owners.set(name, call)

  const styles = new Map(
    extracted.styles.styles.map((style) => [style.name, style]),
  )

  const themeOwners = new Map(
    extracted.themeCalls.flatMap((call) =>
      [...new Set([call.name, ...Object.values(call.members ?? {})])].map(
        (name) => [emitted.themes[name], { ...call, name }] as const,
      ),
    ),
  )

  const linkedOwners = new Map(
    Object.entries(options[Themes.context]?.owners ?? {}).map(
      ([key, owner]) => [emitted.themes[key], owner],
    ),
  )

  // Literal and scalar-theme rules each occupy one line at this boundary.
  const prefix = emitted.contributionCss ?? ''
  const scoped = emitted.scopedCss ?? emitted.css
  const css = [
    prefix,
    (scoped ? scoped.split('\n') : [])
      .map((rule, index) => {
        const line = index + 1 + (prefix ? prefix.split('\n').length : 0)
        const brace = rule.indexOf('{')
        const name = rule.slice(1, brace)
        const linkedOwner = linkedOwners.get(name)
        if (linkedOwner) {
          const lines = linkedOwner.source
            .slice(0, linkedOwner.call.start)
            .split('\n')
          Mapping.setSourceContent(
            cssMap,
            linkedOwner.moduleId,
            linkedOwner.source,
          )
          Mapping.addMapping(cssMap, {
            generated: { column: 0, line },
            name: linkedOwner.call.name,
            original: { line: lines.length, column: lines.at(-1)!.length },
            source: linkedOwner.moduleId,
          })
          return rule
        }
        const themeOwner = themeOwners.get(name)
        if (themeOwner) {
          Mapping.addMapping(cssMap, {
            generated: { column: 0, line },
            name: themeOwner.name,
            original: position(themeOwner.start),
            source: options.moduleId,
          })
          return rule
        }
        if (Object.values(emitted.themes).includes(name)) {
          // Packed theme declarations have no authored source in this graph.
          Mapping.addMapping(cssMap, { generated: { column: 0, line } })
          return rule
        }
        const selector = `.${names.get(name)!}`
        const call = owners.get(name)!
        Mapping.addMapping(cssMap, {
          generated: { column: 0, line },
          name: call.name,
          original: position(call.start),
          source: options.moduleId,
        })

        const body = rule.slice(brace)
        const style = styles.get(call.name)!
        function declarations(
          style: Style.NamedStyle,
        ): readonly Style.Declaration[] {
          return style.rules
            ? style.rules.flatMap((rule) => declarations(rule.style))
            : style.declarations
        }
        const conditionNodes: Extract<Ast.Node, { type: 'Property' }>[] = []
        function locations(node: Ast.ObjectExpression): readonly Ast.Node[] {
          return node.properties.flatMap((property) => {
            if (property.type !== 'Property') return []
            const value = Expression.unwrap(property.value)
            if (value.type === 'ObjectExpression') {
              conditionNodes.push(property)
              return locations(value)
            }
            if (value.type === 'ArrayExpression')
              return value.elements.filter(
                (node): node is NonNullable<typeof node> => node !== null,
              )
            return [property]
          })
        }
        const ordered = declarations(style)
        const authored = locations(definitions.get(call.start)!)
        const conditionStarts = declarationStarts(body, true)
        for (const [index, start] of conditionStarts.entries()) {
          const node = conditionNodes[index]
          if (!node) continue
          Mapping.addMapping(cssMap, {
            generated: { column: selector.length + start, line },
            name: options.source.slice(node.key.start, node.key.end),
            original: position(node.key.start),
            source: options.moduleId,
          })
        }
        const starts = declarationStarts(body)
        let cursor = 1
        for (
          let propertyIndex = 0;
          propertyIndex < ordered.length;
          propertyIndex++
        ) {
          const declaration = ordered[propertyIndex]!
          const text = `${declaration.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:`
          const start =
            starts.find(
              (start) => start >= cursor && body.startsWith(text, start),
            ) ?? -1
          if (start < 0) continue

          const location = authored[propertyIndex]!
          Mapping.addMapping(cssMap, {
            generated: { column: selector.length + start, line },
            name: declaration.property,
            original: position(location.start),
            source: options.moduleId,
          })
          cursor = start + text.length
        }

        return selector + body
      })
      .join('\n'),
  ]
    .filter(Boolean)
    .join('\n')

  const map = module.generateMap({
    hires: true,
    includeContent: true,
    source: options.moduleId,
  })

  return Object.freeze({
    classes,
    code: module.toString(),
    css,
    cssMap: Mapping.toEncodedMap(cssMap),
    map: {
      file: options.moduleId,
      mappings: map.mappings,
      names: map.names,
      sources: map.sources,
      sourcesContent: map.sourcesContent!,
      version: 3 as const,
    },
    themes: emitted.themes,
  })
}

/** Source transform contracts. */
export declare namespace compile {
  /** Public failures from extraction and target compilation. */
  type ErrorType = Css.CompileError | Source.ExtractError
  /** Supplied module identity and source; no file loading occurs. */
  type Options = Source.extract.Options
  /** Executable module and stylesheet artifacts; TypeScript/JSX lowering belongs to the host. */
  type ReturnType = {
    /** Module-scoped class lists keyed by extracted definition identity. */
    readonly classes: Readonly<Record<string, string>>
    /** Rewritten source with imports for surviving props callables. */
    readonly code: string
    /** Ordered, unminified stylesheet text. */
    readonly css: string
    /** Standard stylesheet map with authored selector/declaration locations. */
    readonly cssMap: Mapping.EncodedSourceMap
    /** Standard rewritten-module map, including original source content. */
    readonly map: Mapping.EncodedSourceMap
    /** Stable scope classes keyed by local module/binding identity. */
    readonly themes: Readonly<Record<string, string>>
  }
}

/** Locates emitted declarations while skipping selectors, conditions, and quoted CSS data. */
function declarationStarts(
  body: string,
  conditions = false,
): readonly number[] {
  const starts: number[] = []
  let start = 0
  let depth = 0
  let blocks = 0
  let custom = false
  let quote = ''
  for (let index = 0; index < body.length; index++) {
    const char = body[index]!
    if (char === '\\') {
      index++
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '/' && body[index + 1] === '*') {
      const end = body.indexOf('*/', index + 2)
      if (end < 0) break
      index = end + 1
      continue
    }
    if (char === '(' || char === '[') {
      depth++
      continue
    }
    if (char === ')' || char === ']') {
      depth--
      continue
    }
    if (depth) continue
    if (char === ':' && body.slice(start, index).trimStart().startsWith('--'))
      custom = true
    if (char === '{') {
      if (custom) blocks++
      else {
        if (conditions && index > start) starts.push(start)
        start = index + 1
      }
    } else if (char === '}') {
      if (blocks) blocks--
      else {
        start = index + 1
        custom = false
      }
    } else if (char === ';' && !blocks) {
      while (/\s/.test(body[start] ?? '') && start < index) start++
      if (!conditions) starts.push(start)
      start = index + 1
      custom = false
    }
  }
  return starts
}
