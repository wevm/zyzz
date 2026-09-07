import * as Mapping from '@jridgewell/gen-mapping'
import type * as Ast from '@oxc-project/types'
import MagicString from 'magic-string'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import * as Css from '../web/Css.js'
import * as Source from './Source.js'

/**
 * Rewrites literal web authoring without evaluation, file access, or transpilation.
 * Direct no-argument applications become props; other definitions become callables.
 * CSS retains ordered composition and receives module-scoped class identities.
 * @param options - Source text and a stable package-relative module identity.
 * @returns Rewritten TypeScript/JSX and CSS with separate version-three maps.
 * @throws {Source.ExtractError} If the source is outside the supported literal subset.
 * @throws {Css.CompileError} If literal CSS compilation fails.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const extracted = Source.extract(options)
  const emitted = Css.compile({ styles: extracted.styles })
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
  for (const call of extracted.calls) {
    const application = applications.get(call.start)!
    const props = `{className:${JSON.stringify(classes[call.name])}}`
    module.overwrite(
      call.start,
      application.end,
      application.folded ? `(${props})` : `${runtime}.create(${props})`,
    )
    if (!application.folded) callable = true
  }

  function replaced(reference: Span) {
    let low = 0
    let high = extracted.calls.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (extracted.calls[middle]!.start <= reference.start) low = middle + 1
      else high = middle
    }

    const call = extracted.calls[low - 1]
    return (
      call !== undefined && reference.end <= applications.get(call.start)!.end
    )
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
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) !== 'css'
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

  if (callable) {
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
      `\nimport { Props as ${runtime} } from 'zyzz/runtime';\n`,
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

  // The bounded literal emitter produces one single-line class rule per line.
  const css = (emitted.css ? emitted.css.split('\n') : [])
    .map((rule, index) => {
      const line = index + 1
      const brace = rule.indexOf('{')
      const name = rule.slice(1, brace)
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
      let cursor = 1
      for (
        let propertyIndex = 0;
        propertyIndex < style.declarations.length;
        propertyIndex++
      ) {
        const declaration = style.declarations[propertyIndex]!
        const text = `${declaration.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${declaration.value};`
        const start = body.indexOf(text, cursor)
        if (start < 0) continue

        const property = properties[propertyIndex]!
        Mapping.addMapping(cssMap, {
          generated: { column: selector.length + start, line },
          name: declaration.property,
          original: position(property.start),
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
  }
}
