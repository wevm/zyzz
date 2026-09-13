/** Resolves proven static applications into ordered compiler-owned composition groups. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import type * as Style from '../../Style.js'
import type * as Source from '../Source.js'
import * as Applications from './Applications.js'
import * as Expression from './Expression.js'
import * as Scope from './Scope.js'
import * as Themes from './Themes.js'

/** Collects static compositions without evaluating expressions or changing binding reads. */
export function collect(options: collect.Options) {
  if (
    !options.program.body.some(
      (node) =>
        node.type === 'ImportDeclaration' &&
        node.source.value === 'zyzz' &&
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
  const applications = Applications.create(options.program, options.calls)
  const scope = new Scope.Tracker()
  const nodes: Ast.CallExpression[] = []
  Walker.walk(options.program, {
    scopeTracker: scope,
    enter(node, parent) {
      applications?.enter(node, parent)
      if (node.type === 'CallExpression') {
        const call = options.calls.find((call) => call.start === node.start)
        const body = call?.body ?? node.arguments[0]
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
        binding.node.type !== 'ImportSpecifier'
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
  const result: { call: Source.Call; style: Style.NamedStyle }[] = []

  for (const node of nodes.reverse()) {
    const selected: Source.Call[] = []
    const guards: string[] = []
    if (node.optional)
      throw new Themes.InvalidError(
        'Static composition does not support optional calls.',
        node,
      )
    for (const argument of node.arguments) {
      const value = Expression.unwrap(argument)
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
          'Composition currently requires static local style applications.',
          value,
        )
      const nested = calls.get(value.start)
      if (nested?.composition) {
        selected.push(nested)
        guards.push(...nested.composition)
        continue
      }
      if (value.arguments.length)
        throw new Themes.InvalidError(
          'Static composition applications cannot have overrides or selections.',
          value,
        )
      const application = applied.get(value.start)
      const call = application
        ? byName.get(application.name)
        : value.callee.type === 'CallExpression'
          ? calls.get(value.callee.start)
          : undefined
      if (!call || call.recipe || call.slots)
        throw new Themes.InvalidError(
          'Composition currently requires static local style applications.',
          value,
        )
      selected.push(call)
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
      composition: guards,
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
    result.push({ call, style })
  }
  return result.reverse()
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
