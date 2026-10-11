/**
 * Extracts literal styles and local themes through lexical source analysis in TypeScript.
 * Graph contexts and module rewriting read its source-owned syntax until those stages run in Rust.
 * @module
 */
import * as Identity from '../../internal/Identity.js'
import * as Identifiers from './Identifiers.js'
import type * as Ast from '@oxc-project/types'
import * as AtRules from './AtRules.js'
import * as Binding from '../../internal/Binding.js'
import * as Condition from '../../internal/Condition.js'
import type * as Composition from '../../runtime/Composition.js'
import * as Compositions from './Compositions.js'
import * as Contributions from './Contributions.js'
import * as Css from '../../web/Css.js'
import * as Dynamic from './Dynamic.js'
import * as Expression from './Expression.js'
import * as Selectors from './Selectors.js'
import type * as Namespace from '../../web/internal/Namespace.js'
import * as Syntax from './Syntax.js'
import * as RuleReference from '../../internal/RuleReference.js'
import type * as Recipe from '../../runtime/Recipe.js'
import type * as StaticRecipe from '../../internal/Recipe.js'
import type * as RecipePayloads from './RecipePayloads.js'
import * as Recipes from './Recipes.js'
import * as PackedStyles from './PackedStyles.js'
import * as Scope from './Scope.js'
import type * as Shorthands from '../../internal/Shorthands.js'
import * as Static from './Static.js'
import * as Style from '../../Style.js'
import type * as Theme from '../../internal/Theme.js'
import * as Themes from './Themes.js'
import * as ThemeValues from '../../web/internal/Themes.js'
import * as Token from '../../internal/Token.js'
import * as Literal from '../../internal/Literal.js'
import * as Names from './Names.js'
import * as ClassName from '../../web/internal/ClassName.js'
import * as Typography from '../../internal/Typography.js'
import * as Value from '../../internal/Value.js'
import * as Vars from './Vars.js'
import * as Walker from 'oxc-walker'
import * as Source from '../Source.js'

// JavaScript extraction supplies untyped values. Keep structural checks without
// asserting that those values already satisfy the TypeScript authoring contract.
const define = Style.define as unknown as (
  styles: Record<string, unknown>,
  options: Style.define.Options,
) => Style.Definition

/**
 * Extracts direct style calls and local Theme definitions imported from zyzz.
 * Parses TypeScript and JSX without reading files, loading config, or evaluating source.
 * @param options - Source text and a portable package-relative module identity.
 * @returns Frozen style/theme definitions and rewrite spans. Source text is unchanged.
 * @throws {Source.ExtractError} For syntax errors, unsupported imported references, or invalid literals.
 */
export function extract(options: Source.extract.Options): Source.extract.ReturnType {
  const calls: Source.Call[] = []
  const diagnostics: Source.Diagnostic[] = []
  const pending: Ast.CallExpression[] = []
  const recipes = new Set<number>()
  const styles: Style.NamedStyle[] = []

  function report(
    code: Source.Diagnostic['code'],
    message: string,
    node?: Pick<Ast.Node, 'end' | 'start'>,
  ) {
    diagnostics.push({
      code,
      end: node?.end ?? 0,
      message,
      source: options.moduleId,
      start: node?.start ?? 0,
    })
  }

  if (
    !options.moduleId ||
    options.moduleId.includes('\\') ||
    options.moduleId.includes(':') ||
    options.moduleId
      .split('/')
      .some((part) => !part || part === '.' || part === '..')
  ) {
    report(
      'invalid_module',
      'Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.',
    )
    throw new Source.ExtractError(diagnostics)
  }

  const namespace = identity(options.moduleId)
  const parsed = options[Themes.context]?.parsed ?? Syntax.parse(options)
  for (const node of parsed.program.body) {
    if (node.type !== 'ImportDeclaration' || node.source.value !== 'zyzz')
      continue
    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue
      const name =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value
      if (name === 'Theme' || name === 'Variables')
        throw new Source.ExtractError([
          {
            code: 'unsupported_syntax',
            message: `Import Vars instead of ${name}.`,
            source: options.moduleId,
            start: specifier.start,
            end: specifier.end,
          },
        ])
    }
  }

  if (parsed.errors.length) {
    for (const error of parsed.errors) {
      const span = error.labels[0]

      report('syntax_error', error.message, span)
    }

    throw new Source.ExtractError(diagnostics)
  }

  const program = parsed.program
  const authoredNames = Names.collect(program)
  const scopeTracker = new Scope.Tracker({ preserveExitedScopes: true })

  Walker.walk(program, { scopeTracker })
  scopeTracker.freeze()

  const staticData = Static.create(
    program,
    scopeTracker,
    options[Themes.context]?.constants,
  )

  const contributions = (() => {
    try {
      return Contributions.scan(
        program,
        scopeTracker,
        namespace,
        options[Themes.context]?.links,
        options[Themes.context]?.factories,
      )
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error

      report('unsupported_syntax', error.message, error)
      throw new Source.ExtractError(diagnostics)
    }
  })()

  const variables = (() => {
    try {
      return Vars.collect(
        program,
        namespace,
        scopeTracker,
        options[Themes.context]?.links,
        options.moduleId,
      )
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error

      report('unsupported_syntax', error.message, error)
      throw new Source.ExtractError(diagnostics)
    }
  })()

  const themes = (() => {
    try {
      return Themes.collect(program, {
        native: options.target === 'native',
        staticBindings: staticData.bindings,
        namespace: `src-${Identity.label(
          options.moduleId
            .split('/')
            .at(-1)!
            .replace(/\.[cm]?[jt]sx?$/, ''),
        )}-${Identity.compact(options.moduleId)}`,
        contributionCalls: new Set(
          contributions.calls.map((call) => call.start),
        ),
        linked: options[Themes.context] !== undefined,
        links: options[Themes.context]?.links,
      })
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error

      report('unsupported_syntax', error.message, error)
      throw new Source.ExtractError(diagnostics)
    }
  })()

  const ancestors: Ast.Node[] = []
  const typeAncestors = new Set<Ast.Node>()
  const typeNodes = new Set([
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    'TSTypeAnnotation',
    'TSTypeParameterDeclaration',
    'TSTypeParameterInstantiation',
    'TSTypeQuery',
  ])

  Walker.walk(program, {
    enter(node, parent) {
      const declaration = staticData.visitor.enter(node, parent)
      ancestors.push(node)
      if (
        (parent &&
          'typeAnnotation' in parent &&
          parent.typeAnnotation === node) ||
        typeNodes.has(node.type) ||
        (node.type === 'ExportNamedDeclaration' &&
          (node.source !== null || node.exportKind === 'type')) ||
        (node.type === 'ExportSpecifier' && node.exportKind === 'type')
      )
        typeAncestors.add(node)

      if (
        (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') ||
        !parent ||
        (node.type === 'Identifier'
          ? declaration === undefined
          : !Walker.isReferenceIdentifier(node, parent))
      )
        return

      // Both passes visit identical scopes; skipping type subtrees changes scope IDs.
      if (typeAncestors.size) return

      const binding =
        node.type === 'Identifier'
          ? (declaration ?? null)
          : scopeTracker.getDeclaration(node.name)

      contributions.read(node, parent, binding)

      try {
        if (variables.reference(node, parent, ancestors, binding)) return
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error

        report('unsupported_syntax', error.message, error)

        return
      }

      if (themes)
        try {
          if (
            themes.reference(
              node,
              parent,
              ancestors,
              binding,
              (name) => scopeTracker.getDeclaration(name) ?? null,
            )
          )
            return
        } catch (error) {
          if (!(error instanceof Themes.InvalidError)) throw error

          report('unsupported_syntax', error.message, error)

          return
        }

      if (
        binding?.type !== 'Import' ||
        binding.importNode.source.value !== 'zyzz' ||
        binding.importNode.importKind === 'type'
      )
        return

      const specifier = binding.node

      if (specifier.type === 'ImportNamespaceSpecifier') {
        if (parent.type === 'MemberExpression' && parent.object === node) {
          const name = (() => {
            if (parent.property.type === 'Identifier' && !parent.computed) {
              return parent.property.name
            }

            if (parent.property.type === 'Literal') {
              return parent.property.value
            }

            return undefined
          })()

          if (
            name === 'Config' ||
            name === 'cx' ||
            name === 'defineConfig' ||
            name === 'defineVars' ||
            name === 'extendVars' ||
            name === 'style' ||
            name === 'Theme' ||
            name === 'Vars' ||
            name === 'variable' ||
            name === 'variants'
          )
            report(
              'unsupported_syntax',
              `Import ${name} by name; namespace authoring calls are not supported yet.`,
              parent,
            )
        }

        return
      }

      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type' ||
        !['style', 'variants'].includes(
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value,
        )
      )
        return

      // Follow only assignment targets; computed keys and default values are reads.
      let target: Ast.Node = node
      let write: Ast.Node | undefined

      for (let index = ancestors.length - 2; index >= 0; index--) {
        const ancestor = ancestors[index]!

        if (
          (ancestor.type === 'AssignmentExpression' &&
            ancestor.left === target) ||
          (ancestor.type === 'UpdateExpression' &&
            ancestor.argument === target) ||
          ((ancestor.type === 'ForInStatement' ||
            ancestor.type === 'ForOfStatement') &&
            ancestor.left === target)
        ) {
          write = ancestor
          break
        }

        if (
          (ancestor.type === 'Property' && ancestor.value === target) ||
          ancestor.type === 'ObjectPattern' ||
          ancestor.type === 'ArrayPattern' ||
          (ancestor.type === 'RestElement' && ancestor.argument === target) ||
          (ancestor.type === 'AssignmentPattern' && ancestor.left === target)
        )
          target = ancestor
        else break
      }

      if (write)
        report(
          'unsupported_syntax',
          'Imported style bindings cannot be reassigned.',
          write,
        )
      else if (
        parent.type === 'CallExpression' &&
        parent.callee === node &&
        !parent.optional
      ) {
        pending.push(parent)
        if (
          (specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value) === 'variants'
        )
          recipes.add(parent.start)
      } else
        report(
          'unsupported_syntax',
          'Use a direct style call; aliases, re-exports, and indirect references are not supported yet.',
          node,
        )
    },
    leave(node) {
      ancestors.pop()
      typeAncestors.delete(node)
      staticData.visitor.leave()
    },
    scopeTracker,
  })

  Contributions.resolve(contributions)

  // Imports and reference lists can have a different order from authored calls.
  if (themes)
    for (const entry of themes.styles.values()) {
      pending.push(entry.call)
      if (entry.recipe) recipes.add(entry.call.start)
    }

  pending.sort((a, b) => a.start - b.start)

  const staticCalls = new Set([
    ...pending.map((call) => call.start),
    ...contributions.calls.map((call) => call.start),
  ])
  const opaque = new Set(variables.references.keys())
  const normalized = new Map<number, Ast.Node | Error>()
  const selectorKeys = new Set<number>()
  const composed: Ast.Node[] = []
  for (const call of pending) {
    if (!call.arguments[0]) continue
    try {
      const value = staticData.normalize(call.arguments[0], staticCalls, opaque)
      normalized.set(call.start, value)
      if (value.type === 'ArrayExpression')
        for (const element of value.elements) {
          const entry = element && Expression.unwrap(element)
          if (
            entry?.type === 'Identifier' ||
            entry?.type === 'MemberExpression'
          )
            composed.push(entry)
        }
      const body =
        value.type === 'ArrowFunctionExpression'
          ? staticData.normalize(value.body, staticCalls, opaque)
          : value

      Walker.walk(body, {
        enter(node) {
          if (
            node.type !== 'Property' ||
            node.computed ||
            node.value.type !== 'ObjectExpression' ||
            !(
              (node.key.type === 'Identifier' &&
                node.key.name === 'selectors') ||
              (node.key.type === 'Literal' && node.key.value === 'selectors')
            )
          )
            return

          for (const property of node.value.properties)
            if (property.type === 'Property')
              selectorKeys.add(property.key.start)
        },
      })
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error
      normalized.set(call.start, error)
    }
  }

  for (const call of pending) {
    try {
      Identifiers.explicit(call)
    } catch (error) {
      report('unsupported_syntax', (error as Error).message, call)
    }
  }
  if (diagnostics.length) throw new Source.ExtractError(diagnostics)

  const selectors = (() => {
    try {
      return Selectors.scan(
        program,
        scopeTracker,
        namespace,
        pending,
        options[Themes.context]?.links,
        selectorKeys,
        new Map(
          [...(themes?.styles ?? [])].flatMap(([start, context]) => {
            const id = context.theme[Token.definition].contract[Token.identity]
            return id?.startsWith('id-') ? [[start, id.slice(3)] as const] : []
          }),
        ),
        options.moduleId,
        composed,
      )
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error

      report('unsupported_syntax', error.message, error)
      throw new Source.ExtractError(diagnostics)
    }
  })()

  const bodies = new Map<number, Ast.ObjectExpression>()
  const cssNameCounts = new Map<string, number>()
  for (const call of pending) {
    const name = authoredNames.get(call.start)!
    cssNameCounts.set(name, (cssNameCounts.get(name) ?? 0) + 1)
  }
  const cssNameIndices = new Map<string, number>()
  for (const [callIndex, call] of pending.entries()) {
    const explicitId = (() => {
      try {
        return Identifiers.explicit(call)
      } catch (error) {
        report('unsupported_syntax', (error as Error).message, call)
        return undefined
      }
    })()
    const contractIdentity = themes?.styles.get(call.start)?.theme[
      Token.definition
    ].contract[Token.identity]
    const cssNamespace = contractIdentity?.startsWith('id-')
      ? contractIdentity.slice(3)
      : undefined
    const authoredName = authoredNames.get(call.start)!
    const nameIndex = cssNameIndices.get(authoredName) ?? 0
    cssNameIndices.set(authoredName, nameIndex + 1)
    const cssName =
      explicitId !== undefined
        ? Identity.name(explicitId)
        : `${Identity.compact(options.moduleId).slice(-6)}-${
            authoredName === 'style'
              ? `style-${callIndex}`
              : cssNameCounts.get(authoredName)! > 1
                ? `${authoredName}-${nameIndex}`
                : authoredName
          }`
    const definitionId =
      explicitId === undefined
        ? `${cssNamespace ? `${cssNamespace}-` : ''}${cssName}`
        : `id-${cssNamespace ? `${cssNamespace}-` : ''}${Identity.requireId(explicitId, 'style').slice(3)}`
    let argument = call.arguments[0]

    if (call.arguments.length === 0)
      argument = {
        end: call.end - 1,
        properties: [],
        start: call.end - 1,
        type: 'ObjectExpression',
      }

    while (
      argument?.type === 'TSAsExpression' ||
      argument?.type === 'TSSatisfiesExpression'
    )
      argument = argument.expression

    const original = argument

    try {
      const value = normalized.get(call.start)
      if (value instanceof Error) throw value
      if (value) argument = value as Ast.Expression
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error

      report('unsupported_syntax', error.message, error)
      continue
    }

    const diagnosticCount = diagnostics.length

    const dynamic = (() => {
      if (!argument) return undefined

      try {
        return Dynamic.read(argument, definitionId, staticData.type)
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error

        report('unsupported_syntax', error.message, error)

        return undefined
      }
    })()
    if (diagnostics.length !== diagnosticCount) continue

    let dynamicValues: RecipePayloads.Bindings | undefined = dynamic

    function resolveDynamic(node: Ast.Node) {
      try {
        return dynamicValues?.resolve(node)
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error

        report('unsupported_syntax', error.message, error)

        return undefined
      }
    }

    if (dynamic) {
      try {
        argument = staticData.normalize(
          dynamic.body,
          staticCalls,
          opaque,
        ) as Ast.Expression
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error

        report('unsupported_syntax', error.message, error)
        continue
      }
    }

    const entries =
      argument?.type === 'ArrayExpression' &&
      !dynamic &&
      !recipes.has(call.start)
        ? argument.elements
        : undefined

    if (
      call.arguments.length > 2 ||
      (argument?.type !== 'ObjectExpression' && !entries)
    ) {
      report(
        'unsupported_syntax',
        'Expected one literal object, typed callback, or array of style definitions and literal objects; spreads are not supported.',
        call,
      )
      continue
    }

    const before = diagnostics.length
    let recipe: Recipe.Definition | undefined
    let recipeTypes: Source.Call['recipeTypes']
    let staticRecipe: StaticRecipe.Definition<Ast.ObjectExpression> | undefined
    let dynamicRecipe: StaticRecipe.Definition<Ast.ObjectExpression> | undefined
    if (recipes.has(call.start) && argument?.type === 'ObjectExpression') {
      try {
        if (dynamic)
          throw new Themes.InvalidError(
            'Recipes require static top-level objects.',
            original ?? call,
          )
        const expanded = Recipes.expand(argument, {
          identity: definitionId,
          normalize: (node) => staticData.normalize(node, staticCalls, opaque),
          queries: themes?.styles.get(call.start)?.theme[Token.definition]
            .queries,
          resolveType: staticData.type,
          source: options.source,
        })
        argument = expanded.body
        recipe = expanded.recipe
        staticRecipe = expanded.staticRecipe
        dynamicRecipe = expanded.dynamicRecipe
        recipeTypes = expanded.types
        dynamicValues = expanded.bindings
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error
        report('unsupported_syntax', error.message, error)
        continue
      }
    }
    const name = `style-${namespace}-${call.start}`
    const locations: Style.SourceLocation[] = []
    const typography = new Map<number, number>()
    const typographyQueries = new Map<number, number>()
    const conditionKeys = new Map<string, Ast.Node>()

    function object(
      argument: Ast.ObjectExpression,
      prefix: readonly string[] = [],
    ): Record<string, unknown> {
      const values: Record<string, unknown> = Object.create(null)
      const target = prefix.lastIndexOf('targets')
      if (target !== -1 && prefix.length > 64) {
        report(
          'unsupported_syntax',
          'Target nesting exceeds 64 levels.',
          argument,
        )
        return values
      }
      const depth = prefix.length + 2

      function localSlot(node: Ast.Node) {
        const slot = resolveDynamic(node)

        if (
          slot &&
          prefix.some(
            (key) =>
              !Condition.local(key) && !selectors.localConditions.has(key),
          )
        ) {
          report(
            'unsupported_syntax',
            'Dynamic values require conditions that select the styled element.',
            node,
          )

          return undefined
        }

        return slot
      }

      const properties: Ast.ObjectExpression['properties'] = []
      for (const entry of argument.properties) {
        const key =
          entry.type === 'Property' && !entry.computed
            ? entry.key.type === 'Identifier'
              ? entry.key.name
              : entry.key.type === 'Literal'
                ? entry.key.value
                : undefined
            : undefined
        if (key !== 'selectors' && key !== 'vars') {
          properties.push(entry)
          continue
        }
        if (
          entry.type !== 'Property' ||
          entry.kind !== 'init' ||
          entry.method ||
          entry.shorthand ||
          entry.value.type !== 'ObjectExpression'
        ) {
          report(
            'unsupported_syntax',
            `${key} requires an explicit literal object.`,
            entry,
          )
          continue
        }
        for (const property of entry.value.properties) {
          if (
            property.type !== 'Property' ||
            (key === 'selectors'
              ? !selectors.conditions.has(property.key.start)
              : !property.computed ||
                !variables.references.has(property.key.start))
          ) {
            report(
              'unsupported_syntax',
              key === 'selectors'
                ? 'Selectors require explicit & targets.'
                : 'Variable assignments require declared variable keys.',
              property,
            )
            continue
          }
          properties.push(property)
        }
      }

      for (const property of properties) {
        if (
          property.type !== 'Property' ||
          property.kind !== 'init' ||
          property.method ||
          (property.computed &&
            !selectors.conditions.has(property.key.start) &&
            !variables.references.has(property.key.start) &&
            !contributions.queryKeys.has(property.key.start)) ||
          property.shorthand ||
          (!selectors.conditions.has(property.key.start) &&
            !variables.references.has(property.key.start) &&
            property.key.type !== 'Identifier' &&
            (property.key.type !== 'Literal' ||
              typeof property.key.value !== 'string'))
        ) {
          report(
            'unsupported_syntax',
            'Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.',
            property,
          )
          continue
        }

        const key =
          variables.references.get(property.key.start)?.reference.name ??
          selectors.conditions.get(property.key.start) ??
          contributions.queryKeys.get(property.key.start) ??
          (property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : '')

        if (Object.hasOwn(values, key)) {
          report(
            'unsupported_syntax',
            'Duplicate properties are not supported in source definitions yet.',
            property,
          )
          continue
        }

        if (
          (key === 'targets' || target !== -1) &&
          staticData.absent(property.value)
        )
          continue

        if (key === 'targets' || prefix.at(-1) === 'targets') {
          const input = Expression.unwrap(property.value)
          if (input.type !== 'ObjectExpression') {
            report(
              'unsupported_syntax',
              'Target branches require static declaration objects.',
              input,
            )
            continue
          }
          values[key] = object(input, [...prefix, key])
          continue
        }
        if (target !== -1 && prefix[target + 1] !== 'web') {
          function nativeValue(input: Ast.Node, depth = 0): unknown {
            const node = Expression.unwrap(input)
            if (depth > 64) {
              report(
                'unsupported_syntax',
                'Native value nesting exceeds 64 levels.',
                node,
              )
              return undefined
            }
            if (node.type === 'ObjectExpression')
              return object(node, [...prefix, key])
            if (node.type === 'ArrayExpression')
              return node.elements.map((entry) => {
                if (!entry || entry.type === 'SpreadElement') {
                  report(
                    'unsupported_syntax',
                    'Native arrays require dense static entries.',
                    node,
                  )
                  return undefined
                }
                return nativeValue(entry, depth + 1)
              })
            if (
              node.type === 'Literal' &&
              (node.value === null ||
                ['boolean', 'number', 'string'].includes(typeof node.value))
            )
              return node.value
            if (
              node.type === 'UnaryExpression' &&
              ['+', '-'].includes(node.operator) &&
              node.argument.type === 'Literal' &&
              typeof node.argument.value === 'number'
            )
              return (node.operator === '-' ? -1 : 1) * node.argument.value
            if (node.type === 'TemplateLiteral') {
              const value = Expression.template(node)
              if (typeof value === 'string') return value
            }
            report(
              'unsupported_syntax',
              'Native branches require static literal values.',
              node,
            )
            return undefined
          }
          values[key] = nativeValue(property.value)
          continue
        }
        if (Condition.is(key)) {
          conditionKeys.set(
            JSON.stringify([name, ...prefix, key]),
            property.key,
          )

          const input = Expression.unwrap(property.value)

          if (input.type !== 'ObjectExpression') {
            report(
              'unsupported_syntax',
              'Conditions require literal declaration objects.',
              input,
            )
            continue
          }

          locations.push({
            source: options.moduleId,
            start: property.start,
            end: property.end,
            path: [name, ...prefix, key],
          })
          values[key] = object(input, [...prefix, key])
          continue
        }

        const targets = themes?.styles.get(call.start)?.theme[Token.definition]
          .contract.shorthands?.[key] ?? [key as Style.Declaration['property']]

        function value(node: Ast.Node, path: readonly string[]): unknown {
          const unwrapped = Expression.unwrap(node)
          const token =
            variables.references.get(unwrapped.start) ??
            themes?.tokens.get(unwrapped.start)
          const reference =
            localSlot(node) ??
            (token && token.end === unwrapped.end ? token.reference : undefined)

          if (
            dynamicValues &&
            reference &&
            Object.values(dynamicValues.slots).includes(
              reference as Binding.Reference,
            ) &&
            path.length > depth
          ) {
            report(
              'unsupported_syntax',
              'Dynamic fallback entries are not supported.',
              node,
            )

            return undefined
          }

          node = Expression.unwrap(node)

          const animation = contributions.references.get(node.start)
          if (animation) {
            const kind = contributions.kinds.get(animation)
            if (
              kind &&
              targets.some((target) => !RuleReference.accepts(kind, target))
            ) {
              report(
                'unsupported_syntax',
                'Named stylesheet reference is incompatible with this property.',
                node,
              )
              return undefined
            }
            return animation
          }

          const template =
            node.type === 'TemplateLiteral'
              ? Expression.template(node, 0, (expression, prefix) => {
                  const animation = contributions.references.get(
                    Expression.unwrap(expression).start,
                  )
                  if (animation) {
                    const kind = contributions.kinds.get(animation)
                    if (
                      kind &&
                      targets.some(
                        (target) =>
                          !RuleReference.acceptsExpression(
                            kind,
                            target,
                            prefix,
                          ),
                      )
                    ) {
                      report(
                        'unsupported_syntax',
                        'Named stylesheet reference is incompatible with this property.',
                        expression,
                      )
                      return undefined
                    }
                    return animation
                  }

                  const token =
                    variables.references.get(expression.start) ??
                    themes?.tokens.get(expression.start)
                  const slot = localSlot(expression)

                  if (slot) {
                    if (path.length > depth) {
                      report(
                        'unsupported_syntax',
                        'Dynamic fallback entries are not supported.',
                        expression,
                      )

                      return undefined
                    }

                    return slot
                  }

                  return token?.end === expression.end
                    ? token.reference
                    : undefined
                })
              : undefined

          if (Token.isExpression(template)) {
            for (const part of template.parts) {
              if (
                typeof part !== 'string' &&
                !(Binding.is(part)
                  ? (dynamicValues !== undefined &&
                      Object.values(dynamicValues.slots).includes(part)) ||
                    targets.every(
                      (target) =>
                        Binding.accepts(part.type, target) ||
                        (part.type === 'color' &&
                          Expression.acceptsColor(template, target)),
                    )
                  : targets.every(
                      (target) =>
                        Token.acceptsReference(part, target) ||
                        (part.contract.variableSet &&
                          Expression.acceptsVariables(template, target)) ||
                        (part.group === 'color' &&
                          Expression.acceptsColor(template, target)),
                    ))
              ) {
                report(
                  'unsupported_syntax',
                  Binding.is(part)
                    ? 'Variable domain is incompatible with this property.'
                    : 'Theme variable domain is incompatible with this property.',
                  node,
                )

                return undefined
              }
            }
          }

          if (
            reference &&
            Token.is(reference) &&
            !targets.every((target) =>
              Token.acceptsReference(reference, target),
            ) &&
            !targets.every((target) =>
              dynamicValues?.accepts(
                reference as unknown as Binding.Reference,
                target,
              ),
            )
          ) {
            report(
              'unsupported_syntax',
              'Theme variable domain is incompatible with this property.',
              node,
            )

            return undefined
          }

          if (
            reference &&
            Binding.is(reference) &&
            !(
              dynamicValues &&
              Object.values(dynamicValues.slots).includes(reference) &&
              reference.type !== 'number'
            ) &&
            !targets.every(
              (target) =>
                Binding.accepts(reference.type, target) ||
                dynamicValues?.accepts(
                  reference as unknown as Binding.Reference,
                  target,
                ),
            )
          ) {
            report(
              'unsupported_syntax',
              'Variable domain is incompatible with this property.',
              node,
            )

            return undefined
          }

          let result: unknown

          if (reference) result = reference
          else if (template !== undefined) result = template
          else if (
            node.type === 'Literal' &&
            (typeof node.value === 'string' || typeof node.value === 'number')
          )
            result = node.value
          else if (
            node.type === 'UnaryExpression' &&
            (node.operator === '-' || node.operator === '+') &&
            node.argument.type === 'Literal' &&
            typeof node.argument.value === 'number'
          )
            result =
              node.operator === '-' ? -node.argument.value : node.argument.value
          else if (node.type === 'ArrayExpression' && path.length === depth) {
            result = node.elements.map((element, index) => {
              if (!element || element.type === 'SpreadElement') {
                report(
                  'unsupported_syntax',
                  'Fallback arrays require dense literal entries without spreads.',
                  element ?? node,
                )

                return undefined
              }

              return value(element, [...path, String(index)])
            })
          } else {
            report(
              'unsupported_syntax',
              'Expected a literal string or number; expressions are not evaluated.',
              node,
            )

            return undefined
          }

          locations.push({
            end: node.end,
            path,
            source: options.moduleId,
            start: node.start,
          })

          return result
        }

        values[key] = value(property.value, [name, ...prefix, key])
      }

      if (typeof values.typography === 'string') {
        const theme = themes?.styles.get(call.start)?.theme
        const mappings = theme?.[Token.definition].contract.shorthands
        const explicit = new Set(
          Object.keys(values).flatMap((key) => mappings?.[key] ?? [key]),
        )
        const parsed = Value.parse(values.typography, 'fontFamily')
        const keys = Typography.keys(
          theme,
          parsed && !('invalid' in parsed) ? parsed.value : values.typography,
          explicit,
        )
        const queries = keys.filter(Typography.condition).length
        for (const property of properties) {
          if (property.type !== 'Property') continue
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal'
                ? property.key.value
                : undefined
          if (key === 'typography') {
            typography.set(property.start, keys.length - queries)
            if (queries) typographyQueries.set(property.start, queries)
          }
        }
      }

      return values
    }

    // Each entry becomes an ordered declaration segment, so later entries win as authored declarations do.
    function compose(elements: Ast.ArrayExpression['elements']) {
      const parts: Style.NamedStyle[] = []
      const properties: Ast.ObjectExpression['properties'] = []

      for (const element of elements) {
        const entry =
          element && element.type !== 'SpreadElement'
            ? Expression.unwrap(element)
            : undefined

        if (entry?.type === 'ObjectExpression') {
          const values = object(entry)
          if (diagnostics.length !== before) continue

          parts.push(
            define(
              { [name]: values },
              { locations, vars: themes?.styles.get(call.start)?.theme },
            ).styles[0]!,
          )
          properties.push(...entry.properties)
          continue
        }

        const target = entry && selectors.compositions.get(entry.start)
        const local =
          target && 'type' in target
            ? calls.find((value) => value.start === target.start)
            : undefined
        const packed = target && !('type' in target) ? target.style : undefined
        const style = local
          ? styles.find((style) => style.name === local.name)
          : packed?.style

        if (!style) {
          report(
            'unsupported_syntax',
            'Composition entries require literal objects or previously declared style definitions.',
            element ?? call,
          )
          continue
        }

        if (
          local?.recipe ||
          local?.slots ||
          packed?.dynamic ||
          (packed?.staticRecipe &&
            !(
              packed.staticRecipe.rules.length === 1 &&
              packed.staticRecipe.rules[0]!.value.styles.length === 1 &&
              packed.staticRecipe.rules[0]!.value.styles[0]!.name ===
                packed.style.name
            ))
        ) {
          report(
            'unsupported_syntax',
            'Composition entries cannot be variants or dynamic styles; apply them with cx.',
            entry!,
          )
          continue
        }

        // Native tables select variable alternatives from one context per call.
        if (
          options.target === 'native' &&
          !context(
            local
              ? themes?.nativeContext(local.start, local.end)
              : packed?.nativeContext,
            themes?.nativeContext(call.start, call.end),
          )
        ) {
          report(
            'unsupported_syntax',
            'Native composition entries require the variable catalog of the composing style.',
            entry!,
          )
          continue
        }

        // The composing configuration decides output for every copied entry.
        parts.push(
          Object.fromEntries(
            Object.entries(style).filter(
              ([key]) => key !== 'composition' && key !== 'cssOutput',
            ),
          ) as Style.NamedStyle,
        )

        if (local) {
          properties.push(...(bodies.get(local.start)?.properties ?? []))
          for (const [start, count] of local.typography ?? [])
            typography.set(start, count)
          for (const [start, count] of local.typographyQueries ?? [])
            typographyQueries.set(start, count)
          continue
        }

        // Packed declarations have no authored source here, so they map to the entry.
        properties.push(
          ...declarations(style).map(
            (declaration): Ast.ObjectProperty => ({
              type: 'Property',
              computed: false,
              kind: 'init',
              method: false,
              shorthand: false,
              start: entry!.start,
              end: entry!.end,
              key: {
                type: 'Literal',
                value: declaration.property,
                raw: JSON.stringify(declaration.property),
                start: entry!.start,
                end: entry!.end,
              },
              value: {
                type: 'Literal',
                value: '',
                raw: '""',
                start: entry!.start,
                end: entry!.end,
              },
            }),
          ),
        )
      }

      return {
        body: {
          type: 'ObjectExpression',
          start: call.start,
          end: call.end,
          properties,
        } satisfies Ast.ObjectExpression,
        definition: {
          styles: [
            Object.freeze<Style.NamedStyle>({
              name,
              declarations: Object.freeze([]),
              rules: Object.freeze(
                parts.map((style) => Object.freeze({ style })),
              ),
            }),
          ],
        } satisfies Style.Definition as Style.Definition,
      }
    }

    const values = entries
      ? undefined
      : object(argument as Ast.ObjectExpression)
    if (diagnostics.length !== before) continue

    try {
      const composite = entries && compose(entries)
      if (diagnostics.length !== before) continue

      const definition =
        composite?.definition ??
        define(
          { [name]: values! },
          { locations, vars: themes?.styles.get(call.start)?.theme },
        )

      const body = composite?.body ?? (argument as Ast.ObjectExpression)
      bodies.set(call.start, body)

      function validate(style: Style.NamedStyle, path: readonly string[]) {
        for (const declaration of style.declarations) {
          if (
            Token.is(declaration.value) &&
            declaration.value.contract.variableSet &&
            Literal.rule(declaration.property)?.kind === 'identifier' &&
            !Expression.acceptsIdentifier(
              declaration.value,
              declaration.property,
            )
          )
            report(
              'invalid_literal',
              'Variable value is incompatible with this property.',
              call,
            )
        }
        if (style.targets?.web)
          validate(style.targets.web, [...path, 'targets', 'web'])
        for (const rule of style.rules ?? []) {
          if (rule.condition !== undefined) {
            const location =
              conditionKeys.get(JSON.stringify([...path, rule.condition])) ??
              call

            try {
              AtRules.transform({
                filename: options.moduleId,
                code: Buffer.from(`.z{${rule.condition}{color:red;}}`),
                errorRecovery: false,
              })
            } catch (error) {
              report(
                'unsupported_syntax',
                `Invalid selector or condition: ${(error as Error).message}`,
                location,
              )
            }
          }

          validate(
            rule.style,
            rule.condition === undefined ? path : [...path, rule.condition],
          )
        }
      }

      for (const style of definition.styles) validate(style, [style.name])

      if (diagnostics.length !== before) continue

      const contract = themes?.styles.get(call.start)?.theme[Token.definition]
        .contract
      const composition = contract?.composition
      const cssOutput = contract?.cssOutput
      styles.push(
        ...definition.styles.map((style) =>
          composition || cssOutput
            ? Object.freeze({
                ...style,
                ...(composition ? { composition } : {}),
                ...(cssOutput ? { cssOutput } : {}),
              })
            : style,
        ),
      )

      const shorthands = themes?.styles.get(call.start)?.theme[Token.definition]
        .contract.shorthands

      const retained = staticRecipe ?? dynamicRecipe
      const targetRecipe = retained && {
        ...retained,
        rules: retained.rules.map(({ matches, value }, index) => ({
          matches,
          value: define(
            { [`${name}-${index}`]: object(value) },
            { locations, vars: themes?.styles.get(call.start)?.theme },
          ),
        })),
      }
      calls.push({
        ...(recipe ? { recipe, recipeTypes } : {}),
        ...(staticRecipe
          ? { staticRecipe: targetRecipe }
          : dynamicRecipe
            ? { dynamicRecipe: targetRecipe }
            : {}),
        ...(selectors.identities.has(call.start)
          ? { identity: selectors.identities.get(call.start)! }
          : {}),
        ...(body !== (dynamic?.body ?? original) ? { body } : {}),
        ...(shorthands ? { shorthands } : {}),
        ...(typography.size ? { typography } : {}),
        ...(typographyQueries.size ? { typographyQueries } : {}),
        ...(themes?.styles.get(call.start)?.output
          ? { output: 'html' as const }
          : {}),
        ...(dynamic
          ? {
              slots: dynamic.slots,
              valuesType: options.source.slice(
                dynamic.type.start,
                dynamic.type.end,
              ),
            }
          : {}),
        ...(options.compiler === false
          ? {
              portable: (() => {
                if (explicitId !== undefined) return `z-style-${definitionId}`
                if (
                  dynamic ||
                  recipe ||
                  entries?.length === 0 ||
                  (!definition.styles[0]!.declarations.length &&
                    !definition.styles[0]!.rules &&
                    !definition.styles[0]!.targets)
                )
                  return undefined
                return Identity.style(definition.styles[0]!, cssNamespace)
              })(),
            }
          : {}),
        cssName,
        cssNamespace,
        end: call.end,
        name,
        start: call.start,
      })
    } catch (error) {
      if (!(error instanceof Style.InvalidError)) throw error

      for (const diagnostic of error.diagnostics)
        diagnostics.push({
          code: 'invalid_literal',
          end: diagnostic.location?.end ?? call.end,
          message: diagnostic.message,
          source: options.moduleId,
          start: diagnostic.location?.start ?? call.start,
        })
    }
  }

  try {
    let compositionIndex = 0
    for (const entry of options.target === 'native'
      ? []
      : Compositions.collect({
          calls,
          identity: namespace,
          links: options[Themes.context]?.links,
          program,
          scopes: themes?.scopeApplications,
          source: options.source,
          styles,
        })) {
      const authored = authoredNames.get(entry.call.start)
      const name = authored && authored !== 'style' ? authored : 'composition'
      const cssName = `${name}-${compositionIndex++}-${entry.call.cssName ?? 'style'}`
      calls.push(
        ...(entry.cases ?? []).map((value, index) => ({
          ...value.call,
          cssName: `${cssName}-${index}`,
        })),
        { ...entry.call, cssName },
      )
      styles.push(
        ...(entry.cases ?? []).map((entry) => entry.style),
        entry.style,
      )
    }
  } catch (error) {
    if (!(error instanceof Themes.InvalidError)) throw error
    report('unsupported_syntax', error.message, error)
  }

  if (themes && !diagnostics.length)
    for (const [start, token] of themes.tokens) {
      if (
        !staticData.used.has(start) &&
        !themes.staticTokens.some((node) => node.start === start) &&
        ![...calls, ...contributions.calls].some(
          (call) => start >= call.start && token.end <= call.end,
        )
      )
        report(
          'unsupported_syntax',
          'Theme references require a compiled style declaration.',
          { start, end: token.end },
        )
    }

  let contributionData: readonly Css.Contribution[] = []
  const contributionStarts = [...variables.registrationStarts]

  try {
    for (const [index, registration] of variables.registrations.entries()) {
      try {
        const css = Css.compile({
          styles: { styles: [] },
          contributions: [registration],
        }).css
        AtRules.transform({
          filename: options.moduleId,
          code: new TextEncoder().encode(css),
          errorRecovery: false,
        })
      } catch (error) {
        throw new Themes.InvalidError(
          (error as Error).message,
          variables.registrationLocations[index]!,
        )
      }
    }

    contributionData = [
      ...variables.registrations,
      ...Contributions.extract(
        contributions,
        themes?.tokens ?? new Map(),
        contributionStarts,
        (node) => staticData.resolve(node, staticCalls),
      ),
      ...(themes?.calls ?? []).flatMap((call) =>
        call.options?.layers
          ? [
              {
                kind: 'layers' as const,
                names: call.options.layers as readonly string[],
              },
            ]
          : [],
      ),
    ]

    if (contributionData.length) {
      const rendered = Css.compile({
        styles: { styles: [] },
        contributions: contributionData,
        vars: themes?.themes,
      }).css
      AtRules.transform({
        filename: options.moduleId,
        code: new TextEncoder().encode(rendered),
        errorRecovery: false,
        ...(!options[Themes.context]
          ? {
              visitor: {
                Rule(rule) {
                  if (
                    rule.type === 'import' &&
                    rule.value.url &&
                    !/^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i.test(rule.value.url)
                  )
                    throw new Error(
                      'Relative contribution assets require Graph.compile and a relocation host.',
                    )
                },
                Url(url) {
                  if (
                    url.url &&
                    !/^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i.test(url.url)
                  )
                    throw new Error(
                      'Relative contribution assets require Graph.compile and a relocation host.',
                    )
                },
              },
            }
          : {}),
      })
    }
  } catch (error) {
    report(
      'unsupported_syntax',
      (error as Error).message,
      error instanceof Themes.InvalidError ? error : contributions.calls[0],
    )
  }

  for (const token of themes?.staticTokens ?? [])
    if (!staticData.used.has(Expression.unwrap(token).start))
      report(
        'unsupported_syntax',
        'Token references must be direct property values in bound theme style calls.',
        token,
      )

  if (diagnostics.length) throw new Source.ExtractError(diagnostics)

  function exportedStyle(link: Themes.Link): Themes.Link {
    const call = calls.find((call) => call.identity === link.binding)
    const style = call && styles.find((style) => style.name === call.name)
    return {
      ...link,
      ...(call && style
        ? {
            style: PackedStyles.create(
              {
                ...call,
                nativeContext: themes?.nativeContext(call.start, call.end),
              },
              style,
            ),
          }
        : {}),
      ...(link.members
        ? {
            members: Object.fromEntries(
              Object.entries(link.members).map(([name, member]) => [
                name,
                exportedStyle(member),
              ]),
            ),
          }
        : {}),
    }
  }

  const callsByName = new Map(calls.map((call) => [call.name, call]))
  const definition = {
    styles: Object.freeze(styles),
    [ClassName.labels]: Object.freeze(
      Object.fromEntries(
        styles.map((style) => {
          let name = style.name
          let call = callsByName.get(name)
          while (!call && name.includes('-')) {
            name = name.slice(0, name.lastIndexOf('-'))
            call = callsByName.get(name)
          }
          return [
            style.name,
            {
              name: call?.cssName
                ? call.cssName + style.name.slice(call.name.length)
                : style.name,
              namespace: call?.cssNamespace,
            },
          ]
        }),
      ),
    ),
  }
  Object.defineProperty(definition, ClassName.labels, { enumerable: false })
  const selections =
    options.target === 'native' ? themes?.selectionUses : themes?.selections

  return Object.freeze({
    namespaces: contributionData.filter(
      (value): value is Extract<Css.Contribution, { kind: 'namespace' }> =>
        value.kind === 'namespace',
    ),
    ...(contributionData.length
      ? { contributions: contributionData, contributionStarts }
      : {}),
    ...(contributions.calls.length
      ? { contributionCalls: contributions.calls }
      : {}),
    ...(options[Themes.context]
      ? {
          themeExports: Object.freeze({
            ...themes?.exports,
            ...Object.fromEntries(
              Object.entries(selectors.exports).map(([name, link]) => [
                name,
                exportedStyle(link),
              ]),
            ),
            ...contributions.exports,
            ...variables.exports,
          }),
        }
      : {}),
    calls: Object.freeze(
      calls
        .sort((a, b) => a.start - b.start)
        .map((call) => {
          const nativeContext =
            options.target === 'native'
              ? themes?.nativeContext(call.start, call.end)
              : undefined
          return Object.freeze(
            nativeContext ? { ...call, nativeContext } : call,
          )
        }),
    ),
    styles: Object.freeze(definition),
    ...(variables.calls.length
      ? { variableCalls: Object.freeze(variables.calls) }
      : {}),
    themeAliases: Object.freeze(themes?.aliases ?? []),
    ...(themes?.appearances.size
      ? { themeAppearances: Object.freeze([...themes.appearances]) }
      : {}),
    ...(themes?.scripts.size
      ? { themeScripts: Object.freeze([...themes.scripts]) }
      : {}),
    ...(selections?.size
      ? { themeSelections: Object.freeze([...selections]) }
      : {}),
    themeCalls: Object.freeze(themes?.calls ?? []),
    ...(themes?.staticTokens.length
      ? {
          staticThemeReferences: Object.freeze(
            (themes?.staticTokens ?? []).map((node) => ({
              start: node.start,
              end: node.end,
              value: ThemeValues.create().serialize(
                themes!.tokens.get(node.start)!.reference,
              ),
            })),
          ),
        }
      : {}),
    themeReferences: Object.freeze(themes?.references ?? []),
    vars: themes?.themes ?? Object.freeze({}),
    ...(themes?.varsReads.length
      ? { nativeVars: Object.freeze(themes.varsReads) }
      : {}),
  })
}

/** Accepts an entry context that the composing call selects identically. */
function context(
  entry: Source.Call['nativeContext'],
  composite: Source.Call['nativeContext'],
): boolean {
  if (!entry || entry === composite) return true
  if (!composite || entry.defaultVars !== composite.defaultVars) return false

  const names = Object.keys(entry.vars)
  return (
    names.length === Object.keys(composite.vars).length &&
    names.every((name) => {
      const left = entry.vars[name]?.[Token.definition].contract
      const right = composite.vars[name]?.[Token.definition].contract
      return (
        !!left &&
        !!right &&
        (left === right ||
          (left[Token.identity] !== undefined &&
            left[Token.identity] === right[Token.identity]))
      )
    })
  )
}

/** Lists declarations in emitted order, through conditions and segments. */
function declarations(style: Style.NamedStyle): readonly Style.Declaration[] {
  return style.rules
    ? style.rules.flatMap((rule) => declarations(rule.style))
    : style.declarations
}

function identity(value: string): string {
  let first = 2166136261
  let second = 2246822507

  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619)
    second = Math.imul(second ^ value.charCodeAt(index), 3266489909)
  }

  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
}
