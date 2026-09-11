/** Extracts module-level stylesheet effects without evaluating application code. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as Theme from '../../Theme.js'
import * as Style from '../../Style.js'
import type * as Token from '../../internal/Token.js'
import type * as Css from '../../web/Css.js'
import * as Expression from './Expression.js'
import * as Themes from './Themes.js'
import type * as Scope from './Scope.js'

type Kind = 'fontFace' | 'global' | 'keyframes' | 'layers'
/** Source-owned factory replacement and optional animation identity. */
export type Call = {
  readonly start: number
  readonly end: number
  readonly kind: Kind
  readonly argument: Ast.Node
  readonly name?: string | undefined
  readonly binding?: number | undefined
  readonly exported?: boolean | undefined
}
/** Collects lexical macro calls and animation references. */
export function scan(
  program: Ast.Program,
  scope: Scope.Tracker,
  namespace: string,
  links: Readonly<Record<string, Themes.Link>> = {},
) {
  const imports = new Map<number, Kind>()
  for (const node of program.body)
    if (
      node.type === 'ImportDeclaration' &&
      node.importKind !== 'type' &&
      node.source.value === 'zyzz/web'
    )
      for (const specifier of node.specifiers)
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind !== 'type'
        ) {
          const name =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value
          if (['fontFace', 'global', 'keyframes', 'layers'].includes(name))
            imports.set(specifier.start, name as Kind)
        }
  const exported: Record<string, Themes.Link> = Object.create(null)
  const linkedNames = new Map<string, Themes.Link>()
  const imported = new Map<number, string>()
  for (const node of program.body)
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers) {
        const link = links[specifier.local.name]
        if (link?.kind === 'animation') {
          imported.set(specifier.start, link.call.name)
          linkedNames.set(specifier.local.name, link)
        }
      }
  const calls: Call[] = []
  const bindings = new Map<number, Call>()
  const references = new Map<number, string>()
  const used = new Set<string>()
  const undefinedValues = new Set<number>()
  const ancestors: Ast.Node[] = []
  function kind(node: Ast.Node): Kind | undefined {
    if (node.type === 'Identifier') {
      const binding = scope.getDeclaration(node.name)
      const name =
        binding?.type === 'Import' ? imports.get(binding.node.start) : undefined
      return name
    }
    return undefined
  }
  Walker.walk(program, {
    scopeTracker: scope,
    enter(node, parent) {
      ancestors.push(node)
      if (
        node.type === 'Identifier' &&
        node.name === 'undefined' &&
        !scope.getDeclaration(node.name)
      )
        undefinedValues.add(node.start)
      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.init?.type === 'Identifier'
      ) {
        const declaration = scope.getDeclaration(node.init.name)
        const identity = declaration
          ? imported.get(declaration.node.start)
          : undefined
        const link = identity
          ? [...linkedNames.values()].find(
              (link) => link.call.name === identity,
            )
          : undefined
        if (link) {
          if (parent?.type !== 'VariableDeclaration' || parent.kind !== 'const')
            throw new Themes.InvalidError(
              'Animation aliases require const bindings.',
              node,
            )
          imported.set(node.start, link.call.name)
          if (
            ancestors.at(-3)?.type === 'Program' ||
            ancestors.at(-3)?.type === 'ExportNamedDeclaration'
          )
            linkedNames.set(node.id.name, link)
          if (ancestors.some((node) => node.type === 'ExportNamedDeclaration'))
            exported[node.id.name] = link
        }
      }
      if (node.type !== 'CallExpression') return
      const type = kind(node.callee)
      if (!type) return
      const variable =
        parent?.type === 'VariableDeclarator' && parent.init === node
          ? parent
          : undefined
      const statement = variable ? ancestors.at(-3) : parent
      if (
        node.optional ||
        node.arguments.length !== 1 ||
        (!variable && parent?.type !== 'ExpressionStatement') ||
        ancestors
          .slice(0, -1)
          .some(
            (ancestor) =>
              ![
                'Program',
                'ExportNamedDeclaration',
                'VariableDeclaration',
                'VariableDeclarator',
                'ExpressionStatement',
              ].includes(ancestor.type),
          ) ||
        (variable &&
          (statement?.type !== 'VariableDeclaration' ||
            statement.kind !== 'const' ||
            variable.id.type !== 'Identifier'))
      )
        throw new Themes.InvalidError(
          'Stylesheet contributions require direct module-level calls and constant animation bindings.',
          node,
        )
      if (type === 'keyframes' && !variable)
        throw new Themes.InvalidError(
          'Keyframes require a module-level named constant.',
          node,
        )
      const name =
        variable?.id.type === 'Identifier'
          ? `z-k${namespace}-${Array.from(variable.id.name)
              .map((value) => value.codePointAt(0)!.toString(16))
              .join('-')}`
          : undefined
      const call: Call = {
        kind: type,
        start: node.start,
        end: node.end,
        argument: node.arguments[0]!,
        ...(type === 'keyframes'
          ? {
              name,
              binding: variable!.start,
              exported: ancestors.some(
                (node) => node.type === 'ExportNamedDeclaration',
              ),
            }
          : {}),
      }
      calls.push(call)
      if (call.kind === 'keyframes' && variable?.id.type === 'Identifier') {
        const link: Themes.Link = {
          binding: call.name!,
          kind: 'animation',
          definition: Theme.define({}),
          call: {
            start: call.start,
            end: call.end,
            name: call.name!,
            tokenType: '{}',
          },
        }
        imported.set(variable.start, call.name!)
        linkedNames.set(variable.id.name, link)
        if (call.exported) exported[variable.id.name] = link
      }
      if (call.binding !== undefined) bindings.set(call.binding, call)
    },
    leave() {
      ancestors.pop()
    },
  })
  function read(
    node: Extract<Ast.Node, { type: 'Identifier' | 'JSXIdentifier' }>,
    parent: Ast.Node,
    binding: Walker.ScopeTrackerNode | null,
  ) {
    if (
      (binding?.type === 'Import' || binding?.type === 'Variable') &&
      imported.has(binding.node.start)
    ) {
      references.set(node.start, imported.get(binding.node.start)!)
      used.add(imported.get(binding.node.start)!)
      return
    }
    if (binding?.type !== 'Variable') return
    const call = bindings.get(binding.node.start)
    if (
      !call?.name ||
      (parent.type === 'VariableDeclarator' && parent.id === node)
    )
      return
    references.set(node.start, call.name)
    used.add(call.name)
  }
  for (const statement of program.body)
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.exportKind !== 'type' &&
      !statement.source
    )
      for (const specifier of statement.specifiers) {
        if ('exportKind' in specifier && specifier.exportKind === 'type')
          continue
        const name =
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value
        const link = linkedNames.get(name)
        if (link) {
          used.add(link.call.name)
          exported[
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value
          ] = link
        }
      }
  return { calls, references, read, used, undefinedValues, exports: exported }
}

/** Builds ordered pure web data after lexical theme references are resolved. */
export function extract(
  scanned: ReturnType<typeof scan>,
  tokens: ReadonlyMap<number, { end: number; reference: Token.Reference }>,
  starts?: number[],
): readonly Css.Contribution[] {
  const result: Css.Contribution[] = []
  function value(node: Ast.Node): unknown {
    const reference = tokens.get(node.start)
    if (reference?.end === node.end) return reference.reference
    const animation = scanned.references.get(node.start)
    if (animation) return animation
    node = Expression.unwrap(node)
    if (scanned.undefinedValues.has(node.start)) return undefined
    if (
      node.type === 'Literal' &&
      (typeof node.value === 'string' || typeof node.value === 'number')
    ) {
      return node.value
    }
    if (
      node.type === 'UnaryExpression' &&
      (node.operator === '-' || node.operator === '+') &&
      node.argument.type === 'Literal' &&
      typeof node.argument.value === 'number'
    )
      return node.operator === '-' ? -node.argument.value : node.argument.value
    if (node.type === 'TemplateLiteral') {
      const template = Expression.template(
        node,
        0,
        (expression) =>
          scanned.references.get(expression.start) ??
          tokens.get(expression.start)?.reference,
      )
      if (template !== undefined) return template
    }
    if (node.type === 'ArrayExpression')
      return node.elements.map((element) => {
        if (!element || element.type === 'SpreadElement')
          throw new Themes.InvalidError(
            'Contribution arrays require dense literal entries.',
            node,
          )
        return value(element)
      })
    if (node.type !== 'ObjectExpression')
      throw new Themes.InvalidError(
        'Stylesheet contributions require literal data.',
        node,
      )
    const output: Record<string, unknown> = Object.create(null)
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.shorthand ||
        property.method ||
        property.kind !== 'init'
      )
        throw new Themes.InvalidError(
          'Contribution objects require explicit literal properties.',
          property,
        )
      const key =
        property.key.type === 'Identifier'
          ? property.key.name
          : property.key.type === 'Literal' &&
              typeof property.key.value === 'string'
            ? property.key.value
            : undefined
      if (key === undefined || Object.hasOwn(output, key))
        throw new Themes.InvalidError(
          'Contribution keys must be unique literal strings.',
          property,
        )
      output[key] = value(property.value)
    }
    return output
  }
  function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Expected a contribution object.')
    return value as Record<string, unknown>
  }
  function style(value: unknown): Style.NamedStyle {
    return (
      Style.define as unknown as (
        styles: Record<string, unknown>,
      ) => Style.Definition
    )({ contribution: record(value) }).styles[0]!
  }
  function global(input: unknown): Style.NamedStyle {
    return {
      name: 'global',
      declarations: [],
      rules: Object.entries(record(input)).map(([selector, input]) => ({
        condition: selector,
        style: selector.startsWith('@') ? global(input) : style(input),
      })),
    }
  }
  for (const call of scanned.calls) {
    const before = result.length
    try {
      const input = value(call.argument)
      if (call.kind === 'layers') {
        if (
          !Array.isArray(input) ||
          input.some((value) => typeof value !== 'string')
        )
          throw new Error('Layers require a literal string list.')
        result.push({ kind: 'layers', names: input })
      } else if (call.kind === 'global') {
        for (const [selector, child] of Object.entries(record(input)))
          result.push({
            kind: 'rule',
            selector,
            style: selector.startsWith('@') ? global(child) : style(child),
          })
      } else if (call.kind === 'fontFace') {
        const declarations = record(input)
        for (const key of Object.keys(declarations))
          if (
            declarations[key] === undefined &&
            key !== 'fontFamily' &&
            key !== 'src'
          )
            delete declarations[key]
        const keys = [
          'fontFamily',
          'src',
          'fontDisplay',
          'fontStyle',
          'fontWeight',
          'fontStretch',
          'unicodeRange',
          'sizeAdjust',
          'ascentOverride',
          'descentOverride',
          'lineGapOverride',
        ]
        if (
          typeof declarations.fontFamily !== 'string' ||
          typeof declarations.src !== 'string' ||
          Object.entries(declarations).some(
            ([key, value]) =>
              !keys.includes(key) ||
              (typeof value !== 'string' && typeof value !== 'number'),
          )
        )
          throw new Error(
            'Font faces require family/source and scalar supported descriptors.',
          )
        result.push({
          kind: 'font-face',
          declarations: declarations as Record<string, string | number>,
        })
      } else {
        const frames = Object.entries(record(input)).map(([stop, input]) => {
          if (
            stop.split(',').some((part) => {
              part = part.trim()
              return (
                !['from', 'to'].includes(part) &&
                (!/^(?:\d+(?:\.\d+)?|\.\d+)%$/.test(part) ||
                  parseFloat(part) > 100)
              )
            })
          )
            throw new Error(
              'Keyframe stops must be from, to, or percentages from 0 to 100.',
            )
          const frame = style(input)
          if (
            frame.rules ||
            frame.declarations.some((value) => value.important)
          )
            throw new Error(
              'Keyframes forbid nested rules and important declarations.',
            )
          return { stop, style: frame }
        })
        if (call.exported || scanned.used.has(call.name!))
          result.push({ kind: 'keyframes', name: call.name!, frames })
      }
      for (let index = before; index < result.length; index++)
        starts?.push(call.start)
    } catch (error) {
      throw new Themes.InvalidError((error as Error).message, call)
    }
  }
  return result
}
