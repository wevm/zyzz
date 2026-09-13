/** Resolves known applications into ordered compiler-owned composition groups. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as ConditionalRecipe from '../../runtime/ConditionalRecipe.js'
import type * as Composition from '../../runtime/Composition.js'
import type * as Style from '../../Style.js'
import type * as Source from '../Source.js'
import * as Applications from './Applications.js'
import * as Expression from './Expression.js'
import * as Scope from './Scope.js'
import * as Themes from './Themes.js'

/** Collects ordered compositions without evaluating expressions or changing binding reads. */
export function collect(options: collect.Options) {
  if (
    !options.program.body.some(
      (node) =>
        node.type === 'ImportDeclaration' &&
        node.source.value === 'zyzz' &&
        node.importKind !== 'type' &&
        node.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            (specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value) === 'cx',
        ),
    )
  )
    return []

  const bodies = new Map<number, Ast.ObjectExpression>()
  const undefinedReads = new Set<number>()
  const applications = Applications.create(options.program, options.calls, {
    dynamic: true,
  })
  const scope = new Scope.Tracker()
  const nodes: Ast.CallExpression[] = []
  Walker.walk(options.program, {
    scopeTracker: scope,
    enter(node, parent) {
      applications?.enter(node, parent)
      if (node.type === 'CallExpression') {
        const call = options.calls.find((call) => call.start === node.start)
        const argument = node.arguments[0]
        const body =
          call?.body ??
          (argument?.type === 'ArrowFunctionExpression'
            ? Expression.unwrap(argument.body)
            : argument)
        if (call && body?.type === 'ObjectExpression')
          bodies.set(call.start, body)
      }
      if (
        node.type === 'Identifier' &&
        node.name === 'undefined' &&
        !scope.getDeclaration(node.name)
      )
        undefinedReads.add(node.start)
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier')
        return
      const binding = scope.getDeclaration(node.callee.name)
      if (
        binding?.type !== 'Import' ||
        binding.importNode.source.value !== 'zyzz' ||
        binding.node.type !== 'ImportSpecifier' ||
        binding.importNode.importKind === 'type' ||
        binding.node.importKind === 'type'
      )
        return
      const imported = binding.node.imported
      if (
        (imported.type === 'Identifier' ? imported.name : imported.value) ===
        'cx'
      )
        nodes.push(node)
    },
  })
  const applied = new Map(
    (applications?.find() ?? []).map((application) => [
      application.start,
      application,
    ]),
  )
  const calls = new Map(options.calls.map((call) => [call.start, call]))
  const byName = new Map(options.calls.map((call) => [call.name, call]))
  const styles = new Map(options.styles.map((style) => [style.name, style]))
  type Entry = {
    call: Source.Call
    style: Style.NamedStyle
    cases?:
      | readonly { call: Source.Call; style: Style.NamedStyle }[]
      | undefined
  }
  const result: Entry[] = []

  for (const node of nodes.reverse()) {
    const selected: Source.Call[] = []
    const inputs: NonNullable<Source.Call['runtimeComposition']>[number][] = []
    let runtime = false
    let conditions = 0
    const attributes = new Map<string, string>()

    function owners(call: Source.Call): readonly Composition.Owner[] {
      if (call.runtimeComposition)
        return call.runtimeComposition.flatMap((input) => input.owners)
      return [
        {
          identity: call.name,
          attributes: Object.keys(call.recipe?.axes ?? {}).flatMap((axis) => [
            `data-${axis}`,
            ...(call.recipe?.conditions ?? []).map((_, condition) =>
              ConditionalRecipe.attribute({ axis, condition }),
            ),
          ]),
          slots: [
            ...Object.values(call.slots ?? {}).map((slot) => slot.name),
            ...(call.recipe?.payloads ?? []).flatMap((payload) =>
              payload.slots.flatMap((slots) => Object.values(slots)),
            ),
          ],
        },
      ]
    }
    function input(call: Source.Call, value: Ast.Node, condition?: number) {
      const owned = owners(call)
      for (const owner of owned)
        for (const attribute of owner.attributes) {
          const previous = attributes.get(attribute)
          if (previous && previous !== owner.identity)
            throw new Themes.InvalidError(
              `Recipe attribute ${attribute} has conflicting owners.`,
              value,
            )
          attributes.set(attribute, owner.identity)
        }
      inputs.push({
        start: value.start,
        end: value.end,
        name: call.name,
        owners: owned,
        ...(condition !== undefined ? { condition } : {}),
      })
    }
    const guards: string[] = []
    if (node.optional)
      throw new Themes.InvalidError(
        'Composition does not support optional calls.',
        node,
      )
    for (const argument of node.arguments) {
      const expression = Expression.unwrap(argument)
      const conditional =
        expression.type === 'LogicalExpression' && expression.operator === '&&'
      const condition = conditional ? conditions++ : undefined
      const value = conditional
        ? Expression.unwrap(expression.right)
        : expression
      runtime ||= conditional
      if (undefinedReads.has(value.start)) continue
      if (
        value.type === 'Literal' &&
        (value.value === false || value.value === null)
      )
        continue
      if (
        value.type === 'UnaryExpression' &&
        value.operator === 'void' &&
        value.argument.type === 'Literal'
      )
        continue
      if (value.type !== 'CallExpression' || value.optional)
        throw new Themes.InvalidError(
          'Composition requires statically known local style applications.',
          value,
        )
      const nested = calls.get(value.start)
      if (nested?.compositionCases) {
        if (conditional)
          throw new Themes.InvalidError(
            'Conditional nested compositions require flattening into one cx call.',
            expression,
          )
        for (const child of nested.runtimeComposition!) {
          const call =
            byName.get(child.name) ??
            [...calls.values()].find((call) => call.name === child.name)
          if (!call)
            throw new Themes.InvalidError(
              'Nested composition has an unresolved definition.',
              expression,
            )
          selected.push(call)
          input(
            call,
            { ...node, start: child.start, end: child.end },
            child.condition === undefined ? undefined : conditions++,
          )
        }
        runtime = true
        continue
      }
      if (nested?.composition || nested?.runtimeComposition) {
        selected.push(nested)
        guards.push(...(nested.composition ?? []))
        input(nested, expression, condition)
        runtime ||= !!nested.runtimeComposition
        continue
      }
      const application = applied.get(value.start)
      const call = application
        ? byName.get(application.name)
        : value.callee.type === 'CallExpression'
          ? calls.get(value.callee.start)
          : undefined
      if (!call)
        throw new Themes.InvalidError(
          'Composition requires statically known local style applications.',
          value,
        )
      selected.push(call)
      input(call, expression, condition)
      runtime ||= !!(call.recipe || call.slots || value.arguments.length)
      if (application)
        guards.push(
          options.source.slice(application.start, application.calleeEnd),
        )
    }
    if (selected.some((call) => call.output !== selected[0]?.output))
      throw new Themes.InvalidError(
        'Composition cannot mix HTML and React props.',
        node,
      )

    if (conditions > 8)
      throw new Themes.InvalidError(
        'Composition supports at most eight conditional arguments.',
        node,
      )
    const name = `composition-${options.identity}-${node.start}`
    const style: Style.NamedStyle = {
      name,
      declarations: [],
      rules: selected.flatMap((call) => {
        const style = styles.get(call.name)!
        return style.rules ?? [{ style }]
      }),
    }
    const identities = selected.flatMap((call) =>
      call.identity ? [call.identity] : [],
    )
    const call: Source.Call = {
      name,
      start: node.start,
      end: node.end,
      ...(runtime ? { runtimeComposition: inputs } : { composition: guards }),
      body: {
        type: 'ObjectExpression',
        start: node.start,
        end: node.end,
        properties: selected.flatMap(
          (call) => (call.body ?? bodies.get(call.start))?.properties ?? [],
        ),
      },
      ...(selected[0]?.output ? { output: selected[0].output } : {}),
      ...(identities.length ? { identity: identities.join(' ') } : {}),
    }
    calls.set(node.start, call)
    styles.set(name, style)
    const cases: NonNullable<Entry['cases']>[number][] = []
    const names: string[] = []
    for (let mask = 0; mask < 2 ** conditions - 1; mask++) {
      const included = selected.filter(
        (_, index) =>
          inputs[index]!.condition === undefined ||
          mask & (1 << inputs[index]!.condition!),
      )
      const name = `${call.name}-${mask}`
      names.push(name)
      cases.push({
        call: {
          name,
          start: call.start,
          end: call.end,
          compositionCase: true,
          body: {
            ...call.body!,
            properties: included.flatMap(
              (call) => (call.body ?? bodies.get(call.start))?.properties ?? [],
            ),
          },
          identity: included
            .flatMap((call) => (call.identity ? [call.identity] : []))
            .join(' '),
        },
        style: {
          name,
          declarations: [],
          rules: included.flatMap((call) => {
            const style = styles.get(call.name)!
            return style.rules ?? [{ style }]
          }),
        },
      })
    }
    names.push(call.name)
    const composed = conditions ? { ...call, compositionCases: names } : call
    calls.set(node.start, composed)
    result.push({ call: composed, style, ...(cases.length ? { cases } : {}) })
  }
  return result
}

/** Static composition extraction inputs. */
export declare namespace collect {
  /** Parsed source and previously validated style applications. */
  type Options = {
    /** Extracted authoring calls. */
    readonly calls: readonly Source.Call[]
    /** Stable module identity. */
    readonly identity: string
    /** Parsed module with lexical binding scopes. */
    readonly program: Ast.Program
    /** Source used to preserve initialization-sensitive binding reads. */
    readonly source: string
    /** Validated ordered style bodies. */
    readonly styles: readonly Style.NamedStyle[]
  }
}
