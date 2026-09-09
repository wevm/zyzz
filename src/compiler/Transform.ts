/**
 * Rewrites extracted style calls into executable modules with CSS and source maps.
 * @module
 */
import * as Expression from './internal/Expression.js'
import * as Mapping from '@jridgewell/gen-mapping'
import type * as Ast from '@oxc-project/types'
import * as Entities from 'entities'
import MagicString from 'magic-string'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import * as Css from '../web/Css.js'
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
    themes: Object.keys(extracted.themes).length ? extracted.themes : undefined,
  })
  const module = new MagicString(options.source)
  const program = Parser.parseSync('source.tsx', options.source, {
    preserveParens: false,
    sourceType: 'module',
  }).program

  type Span = Pick<Ast.Node, 'end' | 'start'>
  const applications = new Map<number, { end: number; folded: boolean }>()
  const calls = new Map(extracted.calls.map((call) => [call.start, call]))
  const definitions = new Map<number, Ast.ObjectExpression>()
  const identifiers = new Map<string, Span[]>()
  const elements: Ast.JSXOpeningElement[] = []

  Walker.walk(program, {
    enter(node, parent) {
      if (node.type === 'JSXOpeningElement') elements.push(node)
      if (node.type === 'Identifier') {
        const references = identifiers.get(node.name) ?? []
        references.push(node)
        identifiers.set(node.name, references)
      }

      if (node.type !== 'CallExpression') return
      const call = calls.get(node.start)
      if (!call || node.end !== call.end) return

      const folded =
        !call.value &&
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
      if (argument?.type === 'ObjectExpression')
        definitions.set(call.start, argument)
    },
  })

  let runtime = '__zyzzProps'
  while (identifiers.has(runtime)) runtime += '_'
  let transport = '__zyzzStyle'
  while (identifiers.has(transport)) transport += '_'

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

  let callable = false
  let styled = false
  for (const call of extracted.calls) {
    const application = applications.get(call.start)!
    const props = `{className:${JSON.stringify(classes[call.name])}}`
    module.overwrite(
      call.start,
      application.end,
      (() => {
        if (call.value) return `${transport}.value(${props})`
        if (application.folded) return `(${props})`
        return `${runtime}.create(${props})`
      })(),
    )
    if (call.value) styled = true
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
    const helper = alias.value ? 'style' : 'css'
    const value = alias.destructured ? `{${helper}:undefined}` : 'undefined'
    const type =
      alias.type ?? `import('zyzz').Theme.Definition<${alias.tokenType}>`
    const assertion = /\.[cm]?tsx?$/.test(options.moduleId)
      ? ` as unknown as ${alias.destructured ? `{readonly ${helper}:${type}['${helper}']}` : `${type}['${helper}']`}`
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
    if (node.type !== 'ImportDeclaration' || node.source.value !== 'zyzz')
      continue
    const removed = new Set<Ast.ImportDeclaration['specifiers'][number]>()
    for (const specifier of node.specifiers) {
      if (
        node.importKind === 'type' ||
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type' ||
        !['Config', 'css', 'style', 'Theme'].includes(
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

  // Custom components retain style values; only intrinsic elements consume them.
  // Resolve spreads too, so a component can forward an unchanged props object.
  for (const node of elements) {
    if (node.name.type !== 'JSXIdentifier' || !/^[a-z]/.test(node.name.name))
      continue
    if (
      !node.attributes.some(
        (attribute) =>
          attribute.type === 'JSXSpreadAttribute' ||
          (attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'style'),
      )
    )
      continue
    const first = node.attributes[0]!
    const last = node.attributes.at(-1)!
    module.appendLeft(first.start, `{...${transport}.resolve({`)
    for (const attribute of node.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        module.overwrite(attribute.start, attribute.argument.start, '...')
        module.overwrite(attribute.argument.end, attribute.end, ',')
        continue
      }
      const name =
        attribute.name.type === 'JSXIdentifier'
          ? attribute.name.name
          : `${attribute.name.namespace.name}:${attribute.name.name.name}`
      const prefix =
        name === '__proto__'
          ? `[${JSON.stringify(name)}]:`
          : `${JSON.stringify(name)}:`
      const value = attribute.value
      if (!value)
        module.overwrite(attribute.start, attribute.end, `${prefix}true,`)
      else if (value.type === 'JSXExpressionContainer') {
        module.overwrite(attribute.start, value.start + 1, prefix)
        module.overwrite(value.end - 1, attribute.end, ',')
      } else if (value.type === 'Literal') {
        module.overwrite(
          attribute.start,
          attribute.end,
          `${prefix}${JSON.stringify(typeof value.value === 'string' ? Entities.decodeHTMLStrict(value.value.replace(/\n\s+/g, ' ')) : value.value)},`,
        )
      } else {
        module.overwrite(attribute.start, value.start, prefix)
        module.appendLeft(attribute.end, ',')
      }
    }
    module.appendLeft(last.end, '})}')
    styled = true
  }

  if (callable || styled) {
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
      `\nimport { ${[...(callable ? [`Props as ${runtime}`] : []), ...(styled ? [`Style as ${transport}`] : [])].join(', ')} } from 'zyzz/runtime';\n`,
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
  const css = (emitted.css ? emitted.css.split('\n') : [])
    .map((rule, index) => {
      const line = index + 1
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
      const properties = definitions.get(call.start)!.properties
      const fallbacks = properties.some(
        (property) =>
          property.type === 'Property' &&
          Expression.unwrap(property.value).type === 'ArrayExpression',
      )
      const occurrences = new Map<string, number>()
      let cursor = 1
      for (
        let propertyIndex = 0;
        propertyIndex < style.declarations.length;
        propertyIndex++
      ) {
        const declaration = style.declarations[propertyIndex]!
        const text = `${declaration.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:`
        const start = body.indexOf(text, cursor)
        if (start < 0) continue

        const property = fallbacks
          ? properties.find(
              (property) =>
                property.type === 'Property' &&
                (() => {
                  if (property.key.type === 'Identifier') {
                    return property.key.name
                  }
                  if (property.key.type === 'Literal') {
                    return property.key.value
                  }
                  return undefined
                })() === declaration.property,
            )!
          : properties[propertyIndex]!
        const occurrence = occurrences.get(declaration.property) ?? 0
        occurrences.set(declaration.property, occurrence + 1)
        const value =
          property.type === 'Property'
            ? Expression.unwrap(property.value)
            : undefined
        const location =
          value?.type === 'ArrayExpression'
            ? value.elements[occurrence]!
            : property
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
