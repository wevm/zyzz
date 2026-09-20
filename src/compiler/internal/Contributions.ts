/** Extracts module-level stylesheet effects without evaluating application code. @module */
import * as Identity from '../../internal/Identity.js'
import type * as Ast from '@oxc-project/types'
import type * as Block from '../../web/internal/Block.js'
import * as Condition from '../../internal/Condition.js'
import type * as Css from '../../web/Css.js'
import type { cssFunction } from '../../web/cssFunction.js'
import * as Descriptors from './Descriptors.js'
import * as Expression from './Expression.js'
import * as Functions from './Functions.js'
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Identifiers from './Identifiers.js'
import * as Keyframes from './Keyframes.js'
import * as Lexical from '../../internal/Lexical.js'
import * as Lightning from 'lightningcss'
import * as Literal from '../../internal/Literal.js'
import * as Properties from './Properties.js'
import * as RuleReference from '../../internal/RuleReference.js'
import type * as Scope from './Scope.js'
import * as Style from '../../Style.js'
import * as Theme from '../../internal/Theme.js'
import * as Themes from './Themes.js'
import type * as Token from '../../internal/Token.js'
import * as Walker from 'oxc-walker'

type Kind =
  | 'importCss'
  | 'namespace'
  | 'fontFeatureValues'
  | 'page'
  | 'property'
  | 'viewTransition'
  | 'fontFace'
  | 'global'
  | 'keyframes'
  | 'layers'
  | RuleReference.Kind
const named = [
  'cssFunction',
  'customMedia',
  'colorProfile',
  'counterStyle',
  'fontPaletteValues',
  'keyframes',
  'positionTry',
]
/** Stylesheet factory exports recognized by source and graph linking. */
export const factories: readonly string[] = [
  'importCss',
  'namespace',
  'fontFace',
  'fontFeatureValues',
  'global',
  'layers',
  'page',
  'property',
  'viewTransition',
  ...named,
]

/** Source-owned factory replacement and optional animation identity. */
export type Call = {
  /** CSS function signature populated by literal extraction. */
  readonly function?: NonNullable<Themes.Call['function']> | undefined
  readonly start: number
  readonly end: number
  readonly kind: Kind
  readonly context?: Ast.Node | undefined
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
  factoryImports: Readonly<Record<string, string>> = {},
) {
  const imports = new Map<number, Kind>()

  for (const node of program.body)
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type')
      for (const specifier of node.specifiers)
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind !== 'type'
        ) {
          const imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value
          const name =
            node.source.value === 'zyzz/web'
              ? imported
              : factoryImports[specifier.local.name]
          if (name && factories.includes(name))
            imports.set(specifier.start, name as Kind)
        }

  const exported: Record<string, Themes.Link> = Object.create(null)
  const linkedNames = new Map<string, Themes.Link>()
  const imported = new Map<number, string>()

  for (const node of program.body)
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers) {
        const link = links[specifier.local.name]
        if (link?.kind === 'animation' || link?.kind === 'rule-reference') {
          imported.set(specifier.start, link.call.name)
          linkedNames.set(specifier.local.name, link)
        }
      }

  const calls: Call[] = []
  const functionInputs: {
    name: string
    signature: NonNullable<Themes.Call['function']>
    values: readonly (string | undefined)[]
    node: Extract<Ast.Node, { type: 'CallExpression' }>
  }[] = []
  const bindings = new Map<number, Call>()
  const references = new Map<number, string>()
  const queryKeys = new Map<number, string>()
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

  if (imports.size || imported.size)
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
          node.init &&
          Expression.unwrap(node.init).type === 'Identifier'
        ) {
          const init = Expression.unwrap(node.init) as Extract<
            Ast.Node,
            { type: 'Identifier' }
          >
          const declaration = scope.getDeclaration(init.name)
          const identity = declaration
            ? imported.get(declaration.node.start)
            : undefined

          const link = identity
            ? [...linkedNames.values()].find(
                (link) => link.call.name === identity,
              )
            : undefined

          if (link) {
            if (
              parent?.type !== 'VariableDeclaration' ||
              parent.kind !== 'const'
            )
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

            if (
              ancestors.some((node) => node.type === 'ExportNamedDeclaration')
            )
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
          (node.arguments.length !== 1 &&
            (![
              'fontFace',
              'fontFeatureValues',
              'page',
              'property',
              'viewTransition',
              ...named,
            ].includes(type) ||
              node.arguments.length !== 2)) ||
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
            'Stylesheet contributions require direct module-level calls and constant named stylesheet bindings.',
            node,
          )
        if (named.includes(type) && !variable)
          throw new Themes.InvalidError(
            'Named stylesheet definitions require a module-level named constant.',
            node,
          )

        const context = node.arguments[1]
        const idProperty =
          context?.type === 'ObjectExpression'
            ? context.properties.find(
                (property) =>
                  property.type === 'Property' &&
                  !property.computed &&
                  (property.key.type === 'Identifier'
                    ? property.key.name
                    : property.key.type === 'Literal'
                      ? property.key.value
                      : undefined) === 'id',
              )
            : undefined
        if (
          idProperty &&
          (idProperty.type !== 'Property' ||
            idProperty.value.type !== 'Literal' ||
            typeof idProperty.value.value !== 'string' ||
            !idProperty.value.value)
        )
          throw new Themes.InvalidError(
            'Stylesheet ids must be nonempty string literals.',
            node,
          )

        const explicit =
          idProperty?.type === 'Property' &&
          idProperty.value.type === 'Literal' &&
          typeof idProperty.value.value === 'string'
            ? idProperty.value.value
            : undefined
        const name =
          explicit !== undefined
            ? Identity.contribution(type, explicit)
            : variable?.id.type === 'Identifier'
              ? `${type === 'keyframes' ? 'z-k' : `${type === 'counterStyle' ? '' : '--'}z-${type.toLowerCase()}`}${namespace}-${Array.from(
                  variable.id.name,
                )
                  .map((value) => value.codePointAt(0)!.toString(16))
                  .join('-')}`
              : undefined

        const call: Call = {
          kind: type,
          start: node.start,
          end: node.end,
          argument: node.arguments[0]!,
          context: node.arguments[1],
          ...(type === 'cssFunction'
            ? { function: { parameters: [], returns: '*' as const } }
            : {}),
          ...(named.includes(type)
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
        if (named.includes(call.kind) && variable?.id.type === 'Identifier') {
          const link: Themes.Link = {
            binding: call.name!,
            kind: call.kind === 'keyframes' ? 'animation' : 'rule-reference',
            definition: Theme.define({}),
            call: {
              start: call.start,
              end: call.end,
              name: call.name!,
              tokenType: '{}',
              ...(call.function ? { function: call.function } : {}),
              ...(call.kind !== 'keyframes'
                ? { reference: call.kind as RuleReference.Kind }
                : {}),
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
      const name = imported.get(binding.node.start)!
      const link = [...linkedNames.values()].find(
        (link) => link.call.name === name,
      )
      const text =
        link?.call.reference === 'customMedia' ? `@media (${name})` : name
      references.set(node.start, name)
      if (link?.call.reference === 'customMedia')
        queryKeys.set(node.start, text)
      if (
        link?.call.reference === 'cssFunction' &&
        parent.type === 'CallExpression' &&
        parent.callee === node
      ) {
        // A call and its callee share their start offset. Never keep the bare name
        // when an argument cannot be serialized as a static CSS expression.
        references.delete(node.start)
        const args = parent.arguments.map((argument) => {
          const input = Expression.unwrap(argument)
          if (
            input.type === 'Literal' &&
            (typeof input.value === 'string' || typeof input.value === 'number')
          )
            return String(input.value)
          if (
            input.type === 'UnaryExpression' &&
            (input.operator === '-' || input.operator === '+') &&
            input.argument.type === 'Literal' &&
            typeof input.argument.value === 'number'
          )
            return String(
              input.operator === '-'
                ? -input.argument.value
                : input.argument.value,
            )
          return undefined
        })
        if (link.call.function)
          functionInputs.push({
            name,
            signature: link.call.function,
            values: args,
            node: parent,
          })
        if (args.every((value) => value !== undefined))
          references.set(
            parent.start,
            `${name}(${args.map((value) => (typeof value === 'string' && value.includes(',') && !value.trimStart().startsWith('{') ? `{${value}}` : value)).join(',')})`,
          )
      }
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

  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = Expression.unwrap(statement.declaration)
      const link =
        declaration.type === 'Identifier'
          ? linkedNames.get(declaration.name)
          : undefined

      if (link) {
        used.add(link.call.name)
        exported.default = link
      }
    }

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
  }
  const kinds = new Map(
    [...linkedNames.values()].flatMap((link) =>
      link.call.reference
        ? [[link.call.name, link.call.reference] as const]
        : [],
    ),
  )
  return {
    functionInputs,
    namespace,
    queryKeys,
    calls,
    kinds,
    references,
    read,
    used,
    undefinedValues,
    exports: exported,
  }
}

/** Resolves nested static invocations after lexical reference discovery. */
export function resolve(scanned: ReturnType<typeof scan>): void {
  for (const input of [...scanned.functionInputs].reverse()) {
    input.values = input.values.map((value, index) => {
      const node = Expression.unwrap(input.node.arguments[index]!)
      return (
        value ??
        (node.type === 'CallExpression'
          ? scanned.references.get(node.start)
          : undefined)
      )
    })
    if (input.values.every((value) => value !== undefined))
      scanned.references.set(
        input.node.start,
        `${input.name}(${input.values.map((value) => (value!.includes(',') && !value!.trimStart().startsWith('{') ? `{${value}}` : value)).join(',')})`,
      )
  }
}

/** Builds ordered pure web data after lexical theme references are resolved. */
export function extract(
  scanned: ReturnType<typeof scan>,
  tokens: ReadonlyMap<number, { end: number; reference: Token.Reference }>,
  starts?: number[],
): readonly Css.Contribution[] {
  const result: Css.Contribution[] = []
  function value(node: Ast.Node, property?: string): unknown {
    const reference = tokens.get(node.start)
    if (reference?.end === node.end) return reference.reference
    node = Expression.unwrap(node)

    const animation = scanned.references.get(node.start)
    if (animation) return animation

    node = Expression.unwrap(node)

    if (scanned.undefinedValues.has(node.start)) return undefined

    if (
      node.type === 'UnaryExpression' &&
      node.operator === 'void' &&
      Expression.unwrap(node.argument).type === 'Literal'
    )
      return undefined
    if (
      node.type === 'Literal' &&
      (typeof node.value === 'string' ||
        typeof node.value === 'number' ||
        typeof node.value === 'boolean')
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
      const template = Expression.template(node, 0, (expression, prefix) => {
        const node = Expression.unwrap(expression)
        const name = scanned.references.get(node.start)
        const kind = name ? scanned.kinds.get(name) : undefined
        if (
          kind &&
          property &&
          !RuleReference.acceptsExpression(kind, property, prefix)
        )
          throw new Themes.InvalidError(
            'Named stylesheet reference is incompatible with this descriptor.',
            node,
          )
        return name ?? tokens.get(node.start)?.reference
      })
      if (template !== undefined) return template
    }

    if (node.type === 'ArrayExpression')
      return node.elements.map((element) => {
        if (!element || element.type === 'SpreadElement')
          throw new Themes.InvalidError(
            'Contribution arrays require dense literal entries.',
            node,
          )
        return value(element, property)
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
        (property.computed && !scanned.queryKeys.has(property.key.start)) ||
        property.shorthand ||
        property.method ||
        property.kind !== 'init'
      )
        throw new Themes.InvalidError(
          'Contribution objects require explicit literal properties.',
          property,
        )

      const key =
        scanned.queryKeys.get(property.key.start) ??
        (property.key.type === 'Identifier'
          ? property.key.name
          : property.key.type === 'Literal' &&
              typeof property.key.value === 'string'
            ? property.key.value
            : undefined)
      if (key === undefined || Object.hasOwn(output, key))
        throw new Themes.InvalidError(
          'Contribution keys must be unique literal strings.',
          property,
        )
      const item = Expression.unwrap(property.value)
      const name = scanned.references.get(item.start)
      const kind = name ? scanned.kinds.get(name) : undefined
      if (kind && !RuleReference.accepts(kind, key))
        throw new Themes.InvalidError(
          'Named stylesheet reference is incompatible with this descriptor.',
          item,
        )
      output[key] = value(property.value, key)
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
  function grouping(selector: string): boolean {
    if (!selector.startsWith('@')) return false
    if (!Condition.is(selector))
      throw new Error('Expected a selector or supported grouping rule.')
    if (
      /^@container(?=[\t\n\r\f (/])/.test(selector) &&
      !selector.includes('(')
    )
      throw new Error(
        'Container rules require a query after the optional name.',
      )
    Condition.normalize(selector)
    return true
  }

  function global(input: unknown): Style.NamedStyle {
    return {
      name: 'global',
      declarations: [],
      rules: Object.entries(record(input)).map(([selector, input]) => ({
        condition: selector,
        style: grouping(selector) ? global(input) : style(input),
      })),
    }
  }

  for (const call of scanned.calls) {
    const before = result.length

    try {
      const input = value(call.argument)
      if (call.name && !call.exported && !scanned.used.has(call.name)) continue
      if (call.kind === 'importCss') {
        const options = record(input)
        if (
          Object.keys(options).some(
            (key) => !['layer', 'media', 'supports', 'url'].includes(key),
          ) ||
          typeof options.url !== 'string' ||
          Object.entries(options).some(
            ([key, value]) =>
              key !== 'url' &&
              value !== undefined &&
              typeof value !== 'string' &&
              !(key === 'layer' && value === true),
          )
        )
          throw new Error(
            'Expected a stylesheet URL and static import conditions.',
          )
        result.push({
          kind: 'import',
          url: options.url,
          ...(options.layer !== undefined
            ? { layer: options.layer as string | true }
            : {}),
          ...(options.supports !== undefined
            ? { supports: options.supports as string }
            : {}),
          ...(options.media !== undefined
            ? { media: options.media as string }
            : {}),
        })
      } else if (call.kind === 'namespace') {
        const options = record(input)
        if (
          Object.keys(options).some(
            (key) => !['prefix', 'uri'].includes(key),
          ) ||
          typeof options.uri !== 'string' ||
          (options.prefix !== undefined &&
            (typeof options.prefix !== 'string' ||
              Identifiers.read(options.prefix) === undefined))
        )
          throw new Error(
            'Expected a namespace URI and optional identifier prefix.',
          )
        result.push({
          kind: 'namespace',
          uri: options.uri,
          ...(options.prefix !== undefined
            ? { prefix: options.prefix as string }
            : {}),
          name: `z-n${scanned.namespace}-${call.start.toString(36)}`,
        })
      } else if (call.kind === 'customMedia') {
        if (typeof input !== 'string' && typeof input !== 'boolean')
          throw new Error('Expected a media query or boolean.')
        if (typeof input === 'string') Descriptors.media(input)
        result.push({ kind: 'custom-media', name: call.name!, query: input })
      } else if (call.kind === 'cssFunction') {
        const options = record(input)
        if (
          Object.keys(options).some(
            (key) => !['body', 'parameters', 'returns'].includes(key),
          ) ||
          !Array.isArray(options.parameters) ||
          (options.returns !== undefined &&
            (typeof options.returns !== 'string' ||
              !FunctionSyntax.accepts(options.returns)))
        )
          throw new Error(
            'Expected CSS function parameters, body, and optional return syntax.',
          )
        const names = new Set<string>()
        const parameters = options.parameters.map((input) => {
          const parameter = record(input)
          if (
            Object.keys(parameter).some(
              (key) => !['default', 'name', 'syntax'].includes(key),
            ) ||
            typeof parameter.name !== 'string' ||
            !dashed(parameter.name) ||
            names.has(Identifiers.read(parameter.name)!) ||
            (parameter.syntax !== undefined &&
              (typeof parameter.syntax !== 'string' ||
                !FunctionSyntax.accepts(parameter.syntax))) ||
            (parameter.default !== undefined &&
              typeof parameter.default !== 'string' &&
              typeof parameter.default !== 'number')
          )
            throw new Error(
              'Expected unique CSS parameters with supported syntaxes and scalar defaults.',
            )
          names.add(Identifiers.read(parameter.name)!)
          if (parameter.default !== undefined)
            Functions.value(
              String(parameter.syntax ?? '*'),
              String(parameter.default),
            )
          return `${parameter.name}${parameter.syntax ? ` ${parameter.syntax === '*' ? 'type(*)' : parameter.syntax}` : ''}${parameter.default !== undefined ? `: ${parameter.default}` : ''}`
        })
        function body(input: unknown): readonly Block.Entry[] {
          return Object.entries(record(input)).flatMap(
            ([key, value]): Block.Entry[] => {
              if (value === undefined) return []
              if (/^@(media|supports|container) /.test(key))
                return [
                  {
                    kind: 'block',
                    header: Condition.normalize(key),
                    entries: body(value),
                  },
                ]
              if (
                (key !== 'result' && !dashed(key)) ||
                (typeof value !== 'string' && typeof value !== 'number')
              )
                throw new Error(
                  'CSS function bodies accept result, local variables, and conditional groups.',
                )
              Functions.value('*', String(value))
              return [{ kind: 'descriptor', name: key, value }]
            },
          )
        }
        call.function!.parameters =
          options.parameters as readonly cssFunction.Parameter[]
        call.function!.returns = (options.returns ?? '*') as cssFunction.Syntax
        result.push({
          kind: 'block',
          header: `@function ${call.name}(${parameters.join(',')})${options.returns ? ` returns ${options.returns === '*' ? 'type(*)' : options.returns}` : ''}`,
          entries: body(options.body),
        })
      } else if (call.kind === 'layers') {
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
            style: grouping(selector) ? global(child) : style(child),
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
          'fontFeatureSettings',
          'fontVariationSettings',
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

        for (const [name, value] of Object.entries(declarations))
          Descriptors.check({ rule: 'font-face', name, value: String(value) })
        result.push({
          kind: 'font-face',
          declarations: declarations as Record<string, string | number>,
        })
      } else if (call.kind === 'property') {
        const options = record(input)
        const names =
          typeof options.name === 'string'
            ? Identifiers.list(options.name, 'space')
            : undefined
        if (
          Object.keys(options).some(
            (key) =>
              !['name', 'syntax', 'inherits', 'initialValue'].includes(key),
          ) ||
          names?.length !== 1 ||
          !names[0]!.startsWith('--') ||
          names[0]!.length <= 2 ||
          typeof options.syntax !== 'string' ||
          typeof options.inherits !== 'boolean' ||
          (options.initialValue !== undefined &&
            typeof options.initialValue !== 'string' &&
            typeof options.initialValue !== 'number')
        )
          throw new Error(
            'Expected a native property registration with scalar descriptors.',
          )
        if (options.initialValue !== undefined)
          Properties.initial(String(options.initialValue))
        result.push({
          kind: 'property',
          name: options.name as `--${string}`,
          syntax: options.syntax,
          inherits: options.inherits,
          ...(options.initialValue !== undefined
            ? { initialValue: options.initialValue as string | number }
            : {}),
        })
      } else if (call.kind === 'page') {
        const options = record(input)
        if (
          Object.keys(options).some(
            (key) => !['descriptors', 'selector'].includes(key),
          ) ||
          (options.selector !== undefined &&
            typeof options.selector !== 'string')
        )
          throw new Error('Expected page descriptors and an optional selector.')
        const margins = [
          'top-left-corner',
          'top-left',
          'top-center',
          'top-right',
          'top-right-corner',
          'bottom-left-corner',
          'bottom-left',
          'bottom-center',
          'bottom-right',
          'bottom-right-corner',
          'left-top',
          'left-middle',
          'left-bottom',
          'right-top',
          'right-middle',
          'right-bottom',
        ].map((name) => `@${name}`)
        const properties =
          /^(?!border(?:Collapse|Spacing)$)(?:background|border|font|margin|padding|outline)/
        const names = [
          'color',
          'counterIncrement',
          'counterReset',
          'direction',
          'height',
          'letterSpacing',
          'lineHeight',
          'maxHeight',
          'maxWidth',
          'minHeight',
          'minWidth',
          'quotes',
          'textAlign',
          'textDecoration',
          'textIndent',
          'textTransform',
          'visibility',
          'whiteSpace',
          'width',
          'wordSpacing',
        ]
        function body(input: unknown, margin = false): readonly Block.Entry[] {
          return Object.entries(record(input)).flatMap(
            ([key, value]): Block.Entry[] => {
              if (value === undefined) return []
              if (!margin && margins.includes(key))
                return [
                  { kind: 'block', header: key, entries: body(value, true) },
                ]
              if (
                !margin &&
                ['bleed', 'marks', 'pageOrientation', 'size'].includes(key)
              ) {
                if (typeof value !== 'string' && typeof value !== 'number')
                  throw new Error('Expected a scalar page descriptor.')
                Descriptors.check({
                  rule: 'page',
                  name: key,
                  value: String(value),
                })
                return [
                  {
                    kind: 'descriptor',
                    name: key.replace(
                      /[A-Z]/g,
                      (letter) => `-${letter.toLowerCase()}`,
                    ),
                    value,
                  },
                ]
              }
              if (
                !properties.test(key) &&
                !names.includes(key) &&
                !(
                  margin &&
                  [
                    'content',
                    'overflow',
                    'unicodeBidi',
                    'verticalAlign',
                    'zIndex',
                  ].includes(key)
                )
              )
                throw new Error('Unsupported page or page-margin declaration.')
              return [{ kind: 'style', style: style({ [key]: value }) }]
            },
          )
        }
        result.push({
          kind: 'block',
          header: Condition.normalize(
            `@page${options.selector ? ` ${options.selector}` : ''}`,
          ),
          entries: body(options.descriptors),
        })
      } else if (call.kind === 'fontFeatureValues') {
        const options = record(input)
        if (
          Object.keys(options).some(
            (key) => !['families', 'features', 'fontDisplay'].includes(key),
          )
        )
          throw new Error('Unknown font-feature-values option.')
        const families = options.families
        if (
          typeof families !== 'string' &&
          (!Array.isArray(families) ||
            !families.length ||
            families.some((value) => typeof value !== 'string'))
        )
          throw new Error('Expected a font family list.')
        const familyList = Array.isArray(families)
          ? families
              .map(
                (value) =>
                  '"' +
                  Array.from(value as string, (char) => {
                    const code = char.codePointAt(0)!
                    return code < 32 ||
                      code === 127 ||
                      char === '"' ||
                      char === '\\'
                      ? `\\${code.toString(16)} `
                      : char
                  }).join('') +
                  '"',
              )
              .join(',')
          : families
        // Validate the native prelude before shielding newer body descriptors.
        Lightning.transform({
          filename: 'font-feature-values.css',
          code: new TextEncoder().encode(
            `@font-feature-values ${familyList} {}`,
          ),
        })
        const entries: Block.Entry[] = []
        for (const key of Object.keys(options)) {
          if (key === 'fontDisplay' && options.fontDisplay !== undefined) {
            if (
              typeof options.fontDisplay !== 'string' ||
              !['auto', 'block', 'fallback', 'optional', 'swap'].includes(
                Identifiers.list(options.fontDisplay, 'space')
                  ?.join(' ')
                  .replace(/[A-Z]/g, (letter) => letter.toLowerCase()) ?? '',
              )
            )
              throw new Error('Invalid font display descriptor.')
            entries.push({
              kind: 'descriptor',
              name: 'font-display',
              value: options.fontDisplay,
            })
          }
          if (key !== 'features') continue
          for (const [header, input] of Object.entries(
            record(options.features),
          )) {
            if (input === undefined) continue
            if (
              ![
                '@annotation',
                '@character-variant',
                '@ornaments',
                '@styleset',
                '@stylistic',
                '@swash',
              ].includes(header)
            )
              throw new Error('Unknown font feature block.')
            const declarations: Block.Entry[] = Object.entries(
              record(input),
            ).map(([name, value]) => {
              const values = Array.isArray(value) ? value : [value]
              const maximum =
                header === '@styleset'
                  ? Infinity
                  : header === '@character-variant'
                    ? 2
                    : 1
              if (
                !identifier(name) ||
                !values.length ||
                values.length > maximum ||
                values.some(
                  (value) =>
                    typeof value !== 'number' ||
                    !Number.isSafeInteger(value) ||
                    value < 0,
                )
              )
                throw new Error(
                  'Expected feature aliases with nonnegative integer indices.',
                )
              return { kind: 'descriptor', name, value: values.join(' ') }
            })
            entries.push({ kind: 'block', header, entries: declarations })
          }
        }
        result.push({
          kind: 'block',
          header: `@font-feature-values ${familyList}`,
          entries,
        })
      } else if (call.kind === 'viewTransition') {
        const entries = Object.entries(record(input)).flatMap(
          ([key, value]): Block.Entry[] => {
            if (value === undefined) return []
            if (
              (key !== 'navigation' && key !== 'types') ||
              typeof value !== 'string' ||
              (key === 'navigation' &&
                !['auto', 'none'].includes(
                  Identifiers.list(value, 'space')?.join(' ').toLowerCase() ??
                    '',
                ))
            )
              throw new Error(
                'Expected navigation or types view-transition descriptors.',
              )
            if (key === 'types') {
              const names = Identifiers.list(value, 'space')
              if (
                !names ||
                names.some(
                  (name) =>
                    [
                      'default',
                      'inherit',
                      'initial',
                      'revert',
                      'revert-layer',
                      'unset',
                    ].includes(name.toLowerCase()) ||
                    (name.toLowerCase() === 'none' && names.length !== 1),
                )
              )
                throw new Error(
                  'Expected none or a list of view-transition custom identifiers.',
                )
            }
            Functions.value('*', String(value))
            return [{ kind: 'descriptor', name: key, value }]
          },
        )
        result.push({ kind: 'block', header: '@view-transition', entries })
      } else if (call.kind === 'positionTry') {
        const declarations = record(input)
        const keys = [
          'alignSelf',
          'blockSize',
          'bottom',
          'height',
          'inlineSize',
          'inset',
          'insetBlock',
          'insetBlockEnd',
          'insetBlockStart',
          'insetInline',
          'insetInlineEnd',
          'insetInlineStart',
          'justifySelf',
          'left',
          'margin',
          'marginBlock',
          'marginBlockEnd',
          'marginBlockStart',
          'marginBottom',
          'marginInline',
          'marginInlineEnd',
          'marginInlineStart',
          'marginLeft',
          'marginRight',
          'marginTop',
          'maxBlockSize',
          'maxHeight',
          'maxInlineSize',
          'maxWidth',
          'minBlockSize',
          'minHeight',
          'minInlineSize',
          'minWidth',
          'placeSelf',
          'positionAnchor',
          'positionArea',
          'right',
          'top',
          'width',
        ]
        if (Object.keys(declarations).some((key) => !keys.includes(key)))
          throw new Error('Unsupported position-try declaration.')
        const block = style(declarations)
        if (block.rules || block.declarations.some((value) => value.important))
          throw new Error(
            'Position-try forbids nested rules and important declarations.',
          )
        result.push({
          kind: 'rule',
          selector: `@position-try ${call.name}`,
          style: block,
        })
      } else if (
        call.kind === 'colorProfile' ||
        call.kind === 'counterStyle' ||
        call.kind === 'fontPaletteValues'
      ) {
        const descriptors = {
          colorProfile: {
            rule: 'color-profile',
            keys: ['components', 'renderingIntent', 'src'],
            required: ['src'],
          },
          counterStyle: {
            rule: 'counter-style',
            keys: [
              'additiveSymbols',
              'fallback',
              'negative',
              'pad',
              'prefix',
              'range',
              'speakAs',
              'suffix',
              'symbols',
              'system',
            ],
            required: [],
          },
          fontPaletteValues: {
            rule: 'font-palette-values',
            keys: ['basePalette', 'fontFamily', 'overrideColors'],
            required: ['fontFamily'],
          },
        } as const
        const definition = descriptors[call.kind]
        const declarations = record(input)
        for (const key of Object.keys(declarations))
          if (declarations[key] === undefined) delete declarations[key]
        if (
          definition.required.some(
            (key) => typeof declarations[key] !== 'string',
          ) ||
          Object.entries(declarations).some(
            ([key, value]) =>
              !(definition.keys as readonly string[]).includes(key) ||
              (typeof value !== 'string' &&
                !(
                  key === 'basePalette' &&
                  typeof value === 'number' &&
                  Number.isSafeInteger(value) &&
                  value >= 0
                )),
          )
        )
          throw new Error(
            'Expected supported scalar descriptors and required fields.',
          )
        if (call.kind === 'colorProfile') {
          if (!Identifiers.url(declarations.src as string))
            throw new Error('Color-profile src requires one URL.')
          if (typeof declarations.components === 'string') {
            const names = Identifiers.list(declarations.components, 'comma')
            if (!names || names.some((name) => name.toLowerCase() === 'none'))
              throw new Error(
                'Color-profile components require comma-separated identifiers other than none.',
              )
          }
          if (typeof declarations.renderingIntent === 'string') {
            const names = Identifiers.list(
              declarations.renderingIntent,
              'space',
            )
            if (
              names?.length !== 1 ||
              ![
                'absolute-colorimetric',
                'relative-colorimetric',
                'perceptual',
                'saturation',
              ].includes(names[0]!.toLowerCase())
            )
              throw new Error('Invalid color-profile rendering intent.')
          }
        }
        if (call.kind === 'counterStyle') {
          const system =
            typeof declarations.system === 'string'
              ? Lexical.normalize(declarations.system)
                  .trim()
                  .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
              : 'symbolic'
          try {
            Descriptors.check({
              rule: 'counter-style',
              name: 'system',
              value:
                typeof declarations.system === 'string'
                  ? declarations.system
                  : 'symbolic',
            })
          } catch {
            throw new Error(
              'Expected a supported counter system, with an integer after fixed.',
            )
          }
          const required =
            system === 'additive'
              ? 'additiveSymbols'
              : system.startsWith('extends ')
                ? undefined
                : 'symbols'
          if (
            required &&
            (typeof declarations[required] !== 'string' ||
              !(declarations[required] as string).trim())
          )
            throw new Error(
              'The counter system requires symbols or additiveSymbols.',
            )
        }
        if (call.kind !== 'colorProfile')
          for (const [name, value] of Object.entries(declarations))
            Descriptors.check({
              rule: definition.rule,
              name,
              value: String(value),
            })
        result.push({
          kind: 'descriptor',
          rule: definition.rule,
          name: call.name!,
          declarations: declarations as Record<string, string | number>,
        })
      } else {
        const frames = Object.entries(record(input)).map(([stop, input]) => {
          if (!Keyframes.accepts(stop))
            throw new Error(
              'Keyframe stops require from, to, 0–100% offsets, or named timeline percentages.',
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
      const contextValue = call.context ? value(call.context) : undefined
      if (contextValue !== undefined) {
        const context = record(contextValue)
        if (Object.keys(context).some((key) => !['id', 'within'].includes(key)))
          throw new Error('Unknown contribution context option.')
        if (call.kind === 'customMedia' && 'within' in context)
          throw new Error(
            'Custom media definitions do not accept a within context.',
          )

        const within = context.within ?? []
        if (
          !Array.isArray(within) ||
          within.some(
            (header) =>
              typeof header !== 'string' ||
              !(
                header === '@layer' ||
                /^@(media|supports|container|layer)(?=[\t\n\r\f (/])/.test(
                  header,
                )
              ),
          )
        )
          throw new Error('Expected enclosing conditional or layer headers.')
        const headers = within.map((header: string) =>
          Condition.normalize(header),
        )
        for (let index = before; index < result.length; index++)
          result[index] = { ...result[index]!, within: headers }
      }

      for (let index = before; index < result.length; index++)
        starts?.push(call.start)
    } catch (error) {
      throw new Themes.InvalidError((error as Error).message, call)
    }
  }
  for (const input of scanned.functionInputs)
    if (
      input.values.some((value, index) => {
        const syntax = input.signature.parameters[index]?.syntax ?? '*'
        if (value === undefined || !FunctionSyntax.integerOnly(syntax))
          return false

        const text = value.trim()
        // List contents retain their existing CSS-text contract; this diagnostic checks scalar tokens.
        if (
          (syntax.includes('+') && /\s/.test(text)) ||
          (syntax.includes('#') && text.includes(','))
        )
          return false

        if (!/^[+-]?(?:\d|\.\d)/.test(text) || /^[+-]?\d+$/.test(text))
          return false

        const suffix = /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?(.+)$/.exec(
          text,
        )?.[1]
        const unit =
          suffix === '%'
            ? suffix
            : suffix && Identifiers.read(suffix)?.toLowerCase()
        const normalized = syntax.trim()
        const body = normalized.startsWith('type(')
          ? normalized.slice(5, -1)
          : normalized
        const alternatives = body.split('|').map((part) => part.trim())

        return (
          !unit ||
          !alternatives.some((alternative) => {
            if (alternative === '<percentage>') return unit === '%'
            if (alternative === '<length-percentage>' && unit === '%')
              return true
            if (
              alternative === '<length>' ||
              alternative === '<length-percentage>'
            )
              return (Literal.lengthUnits as readonly string[]).includes(unit)
            if (alternative === '<angle>')
              return ['deg', 'grad', 'rad', 'turn'].includes(unit)
            if (alternative === '<time>') return ['s', 'ms'].includes(unit)
            if (alternative === '<resolution>')
              return ['dpi', 'dpcm', 'dppx', 'x'].includes(unit)
            return false
          })
        )
      })
    )
      throw new Themes.InvalidError(
        'CSS integer parameters require integer tokens.',
        input.node,
      )

  for (const input of scanned.functionInputs) {
    const required =
      input.signature.parameters.findLastIndex(
        (parameter) => parameter.default === undefined,
      ) + 1
    if (
      input.values.length < required ||
      input.values.length > input.signature.parameters.length
    )
      throw new Themes.InvalidError(
        'CSS function arguments must match the declared parameter count.',
        input.node,
      )
    for (const [index, value] of input.values.entries()) {
      if (value === undefined) continue
      try {
        Functions.value(input.signature.parameters[index]?.syntax ?? '*', value)
      } catch (error) {
        throw new Themes.InvalidError((error as Error).message, input.node)
      }
    }
  }
  return result
}

function dashed(value: string): boolean {
  const name = Identifiers.read(value)
  return name !== undefined && name.startsWith('--') && name.length > 2
}

// CSS identifiers allow non-ASCII code points and escaped identifier characters.
function identifier(value: string): boolean {
  const escape = String.raw`\\(?:[\da-fA-F]{1,6}(?:\r\n|[ \t\n\r\f])?|[^\n\r\f\da-fA-F])`
  const start = `(?:[_a-zA-Z\\u0080-\\u{10FFFF}]|${escape})`
  const rest = `(?:[_a-zA-Z0-9-\\u0080-\\u{10FFFF}]|${escape})`
  if (!new RegExp(`^(?:--|-?${start})${rest}*$`, 'u').test(value)) return false
  const decoded = value.replace(
    /\\([\da-fA-F]{1,6})(?:\r\n|[ \t\n\r\f])?|\\([^\n\r\f])/g,
    (_, hex: string | undefined, char: string) =>
      hex ? String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)) : char,
  )
  return ![
    'default',
    'inherit',
    'initial',
    'revert',
    'revert-layer',
    'unset',
  ].includes(decoded.toLowerCase())
}
