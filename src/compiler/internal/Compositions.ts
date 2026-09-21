/** Resolves known applications into ordered compiler-owned composition groups. @module */
import * as Identity from '../../internal/Identity.js'
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as ConditionalRecipe from '../../runtime/ConditionalRecipe.js'
import type * as Composition from '../../runtime/Composition.js'
import type * as Style from '../../Style.js'
import type * as Source from '../Source.js'
import * as Applications from './Applications.js'
import * as CompositionBindings from './CompositionBindings.js'
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
  const bindings = CompositionBindings.create({
    declaration: (name) => scope.getDeclaration(name)?.node,
  })
  const nodes: Ast.CallExpression[] = []
  const aliases = new Map<Ast.Node, Themes.Link>()
  const externalCalls = new Map<string, Source.Call>()
  const externalStyles = new Map<string, Style.NamedStyle>()
  const externalApplications = new Map<
    number,
    { calleeEnd: number; end: number; name: string; start: number }
  >()

  function external(node: Ast.Node): Themes.Link | undefined {
    if (node.type === 'Identifier') {
      const binding = scope.getDeclaration(node.name)
      const alias = binding?.node && aliases.get(binding.node)
      if (alias) return alias

      if (
        binding?.type === 'Import' &&
        binding.importNode.importKind !== 'type'
      )
        return options.links?.[node.name]
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      !node.optional &&
      node.property.type === 'Identifier'
    )
      return external(node.object)?.members?.[node.property.name]
    return undefined
  }

  Walker.walk(options.program, {
    scopeTracker: scope,
    enter(node, parent) {
      applications?.enter(node, parent)
      bindings.enter(node, parent)
      if (
        node.type === 'VariableDeclarator' &&
        node.init &&
        parent?.type === 'VariableDeclaration' &&
        parent.kind === 'const'
      ) {
        const link = external(node.init)
        if (link && node.id.type === 'Identifier') aliases.set(node.id, link)
        if (link && node.id.type === 'ObjectPattern')
          for (const property of node.id.properties)
            if (
              property.type === 'Property' &&
              !property.computed &&
              property.key.type === 'Identifier' &&
              property.value.type === 'Identifier'
            ) {
              const member = link.members?.[property.key.name]
              if (member) aliases.set(property.value, member)
            }
      }

      if (node.type === 'CallExpression') {
        const link = external(node.callee)
        if (link?.style && !node.optional) {
          const name = link.binding
          externalCalls.set(name, {
            end: -1,
            identity: name,
            portable: link.style.className,
            name,
            ...(link.style.output ? { output: link.style.output } : {}),
            ownership: {
              attributes: link.style.attributes,
              identity: name,
              slots: link.style.slots,
            },
            start: node.start,
          })
          externalStyles.set(name, { ...link.style.style, name })
          externalApplications.set(node.start, {
            calleeEnd: node.callee.end,
            end: node.end,
            name,
            start: node.start,
          })
        }
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
    [...(applications?.find() ?? []), ...externalApplications.values()].map(
      (application) => [application.start, application],
    ),
  )
  const calls = new Map(options.calls.map((call) => [call.start, call]))
  const byName = new Map(
    [...options.calls, ...externalCalls.values()].map((call) => [
      call.name,
      call,
    ]),
  )
  const styles = new Map(
    [...options.styles, ...externalStyles.values()].map((style) => [
      style.name,
      style,
    ]),
  )
  type Entry = {
    call: Source.Call
    style: Style.NamedStyle
    cases?:
      | readonly { call: Source.Call; style: Style.NamedStyle }[]
      | undefined
  }
  const result: Entry[] = []

  for (const node of nodes.sort((a, b) =>
    a.start < b.start && a.end >= b.end
      ? 1
      : b.start < a.start && b.end >= a.end
        ? -1
        : a.start - b.start,
  )) {
    const selected: Source.Call[] = []
    const inputs: NonNullable<Source.Call['runtimeComposition']>[number][] = []
    const outputs = new Set<'html' | undefined>()
    let runtime = false
    let conditions = 0
    const attributes = new Map<string, string>()

    function owners(call: Source.Call): readonly Composition.Owner[] {
      if (call.ownership) return [call.ownership]
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
    function input(
      call: Source.Call,
      value: Ast.Node,
      condition?: number,
      applicationStart = value.start,
    ) {
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
        applicationStart,
        end: value.end,
        name: call.name,
        owners: owned,
        start: value.start,
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
      const resolved = bindings.resolve(expression, nodes)
      const conditional =
        resolved.type === 'LogicalExpression' && resolved.operator === '&&'
      const value = conditional
        ? bindings.resolve(resolved.right, nodes)
        : resolved
      runtime ||= conditional || resolved !== expression
      if (
        conditional &&
        (undefinedReads.has(value.start) ||
          (value.type === 'Literal' &&
            (value.value === false || value.value === null)) ||
          (value.type === 'UnaryExpression' &&
            value.operator === 'void' &&
            value.argument.type === 'Literal'))
      )
        throw new Themes.InvalidError(
          'Conditional omissions must be evaluated outside composition.',
          expression,
        )
      const omitted =
        undefinedReads.has(value.start) ||
        (value.type === 'Literal' &&
          (value.value === false || value.value === null)) ||
        (value.type === 'UnaryExpression' &&
          value.operator === 'void' &&
          value.argument.type === 'Literal')
      if (omitted && resolved !== expression)
        inputs.push({
          end: expression.end,
          name: '',
          owners: [],
          start: expression.start,
        })
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
      const scope = options.scopes?.get(value.start)
      if (scope?.end === value.end) {
        outputs.add(scope.output)
        inputs.push({
          start: expression.start,
          end: expression.end,
          name: '',
          owners: [],
        })
        runtime = true
        continue
      }
      const condition = conditional ? conditions++ : undefined
      const nested = calls.get(value.start)
      if (nested?.compositionCases && resolved !== expression)
        throw new Themes.InvalidError(
          'Conditional composition results must remain direct arguments.',
          expression,
        )
      if (nested?.compositionCases && nested.end === value.end) {
        if (conditional)
          throw new Themes.InvalidError(
            'Conditional nested compositions require flattening into one cx call.',
            expression,
          )
        for (const child of nested.runtimeComposition!) {
          if (child.name === '') {
            inputs.push(child)
            continue
          }
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
            child.applicationStart,
          )
        }
        runtime = true
        continue
      }
      if (
        nested?.end === value.end &&
        (nested.composition || nested.runtimeComposition)
      ) {
        selected.push(nested)
        guards.push(...(nested.composition ?? []))
        input(nested, expression, condition, value.start)
        runtime ||= !!nested.runtimeComposition
        continue
      }
      const found = applied.get(value.start)
      const application = found?.end === value.end ? found : undefined
      const call = application
        ? byName.get(application.name)
        : value.callee.type === 'CallExpression'
          ? (() => {
              const call = calls.get(value.callee.start)
              return call?.end === value.callee.end ? call : undefined
            })()
          : undefined
      if (!call || call.composition || call.runtimeComposition)
        throw new Themes.InvalidError(
          'Composition requires statically known local style applications.',
          value,
        )
      selected.push(call.ownership ? { ...call, start: value.start } : call)
      input(call, expression, condition, value.start)
      runtime ||= !!(
        call.ownership ||
        call.recipe ||
        call.slots ||
        value.arguments.length
      )
      if (application)
        guards.push(
          options.source.slice(application.start, application.calleeEnd),
        )
    }
    for (const call of selected) outputs.add(call.output)
    if (outputs.size > 1)
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
      cssOutput: 'atomic',
      name,
      declarations: [],
      rules: selected.flatMap((call) => {
        const style = styles.get(call.name)!
        return (
          style.rules?.map((rule) => ({
            ...rule,
            style: {
              ...rule.style,
              cssOutput: rule.style.cssOutput ?? style.cssOutput,
            },
          })) ?? [{ style }]
        )
      }),
    }
    const identities = selected.flatMap((call) =>
      call.identity ? [call.identity] : [],
    )
    function properties(
      call: Source.Call,
      body = call.body ?? bodies.get(call.start),
    ): Ast.ObjectExpression['properties'] {
      // Imported declarations map to the application; publisher maps retain authored locations.
      if (call.ownership) {
        function declarations(
          style: Style.NamedStyle,
        ): readonly Style.Declaration[] {
          return style.rules
            ? style.rules.flatMap((rule) => declarations(rule.style))
            : style.declarations
        }

        return declarations(styles.get(call.name)!).map((declaration) => ({
          type: 'Property',
          computed: false,
          kind: 'init',
          method: false,
          shorthand: false,
          start: call.start,
          end: call.start,
          key: {
            type: 'Literal',
            value: declaration.property,
            raw: JSON.stringify(declaration.property),
            start: call.start,
            end: call.start,
          },
          value: {
            type: 'Literal',
            value: '',
            raw: '""',
            start: call.start,
            end: call.start,
          },
        }))
      }

      return (
        body?.properties.flatMap<Ast.ObjectExpression['properties'][number]>(
          (property) => {
            if (property.type !== 'Property') return [property]
            const value = Expression.unwrap(property.value)
            if (value.type === 'ObjectExpression')
              return [
                {
                  ...property,
                  value: { ...value, properties: properties(call, value) },
                },
              ]
            const key =
              property.key.type === 'Identifier'
                ? property.key.name
                : property.key.type === 'Literal'
                  ? String(property.key.value)
                  : ''
            return (call.shorthands?.[key] ?? [key]).map((key) => ({
              ...property,
              key: {
                type: 'Literal' as const,
                raw: JSON.stringify(key),
                value: key,
                start: property.key.start,
                end: property.key.end,
              },
            }))
          },
        ) ?? []
      )
    }
    const portable = (calls: readonly Source.Call[]) =>
      calls.every((call) => call.portable)
        ? Identity.composition(
            calls.flatMap((call) => call.portableInputs ?? [call.portable!]),
          )
        : undefined
    const call: Source.Call = {
      ...(portable(selected)
        ? {
            portable: portable(selected),
            portableInputs: selected.flatMap(
              (call) => call.portableInputs ?? [call.portable!],
            ),
          }
        : {}),
      typography: new Map(
        selected.flatMap((call) => [...(call.typography ?? [])]),
      ),
      typographyQueries: new Map(
        selected.flatMap((call) => [...(call.typographyQueries ?? [])]),
      ),
      name,
      start: node.start,
      end: node.end,
      ...(runtime ? { runtimeComposition: inputs } : { composition: guards }),
      body: {
        type: 'ObjectExpression',
        start: node.start,
        end: node.end,
        properties: selected.flatMap((call) => properties(call)),
      },
      ...(outputs.has('html') ? { output: 'html' as const } : {}),
      ...(identities.length ? { identity: identities.join(' ') } : {}),
    }
    calls.set(node.start, call)
    styles.set(name, style)
    const cases: NonNullable<Entry['cases']>[number][] = []
    const names: string[] = []
    // Omitted bindings retain evaluation but own no selected style.
    const selectedInputs = inputs.filter((input) => input.name !== '')
    for (let mask = 0; mask < 2 ** conditions - 1; mask++) {
      const included = selected.filter(
        (_, index) =>
          selectedInputs[index]!.condition === undefined ||
          mask & (1 << selectedInputs[index]!.condition!),
      )
      const name = `${call.name}-${mask}`
      names.push(name)
      cases.push({
        call: {
          ...(portable(included)
            ? {
                portable: portable(included),
                portableInputs: included.flatMap(
                  (call) => call.portableInputs ?? [call.portable!],
                ),
              }
            : {}),
          name,
          start: call.start,
          end: call.end,
          compositionCase: true,
          typography: new Map(
            included.flatMap((call) => [...(call.typography ?? [])]),
          ),
          typographyQueries: new Map(
            included.flatMap((call) => [...(call.typographyQueries ?? [])]),
          ),
          body: {
            ...call.body!,
            properties: included.flatMap((call) => properties(call)),
          },
          identity: included
            .flatMap((call) => (call.identity ? [call.identity] : []))
            .join(' '),
        },
        style: {
          cssOutput: 'atomic',
          name,
          declarations: [],
          rules: included.flatMap((call) => {
            const style = styles.get(call.name)!
            return (
              style.rules?.map((rule) => ({
                ...rule,
                style: {
                  ...rule.style,
                  cssOutput: rule.style.cssOutput ?? style.cssOutput,
                },
              })) ?? [{ style }]
            )
          }),
        },
      })
    }
    names.push(call.name)
    const composed = conditions ? { ...call, compositionCases: names } : call
    calls.set(node.start, composed)
    result.push({
      call: composed,
      style: immutable(style),
      ...(cases.length
        ? {
            cases: cases.map((entry) => ({
              ...entry,
              style: immutable(entry.style),
            })),
          }
        : {}),
    })
  }
  return result.filter(
    ({ call }) =>
      !result.some(
        ({ call: other }) =>
          !!other.composition &&
          other.start < call.start &&
          other.end >= call.end,
      ),
  )
}

/** Static composition extraction inputs. */
export declare namespace collect {
  /** Parsed source and previously validated style applications. */
  type Options = {
    /** Extracted authoring calls. */
    readonly calls: readonly Source.Call[]
    /** Stable module identity. */
    readonly identity: string
    /** Immutable imported style definitions supplied by the source or package graph. */
    readonly links?: Readonly<Record<string, Themes.Link>> | undefined
    /** Parsed module with lexical binding scopes. */
    readonly program: Ast.Program
    /** Validated variable scope applications preserved as runtime props. */
    readonly scopes?:
      | ReadonlyMap<
          number,
          { readonly end: number; readonly output: 'html' | undefined }
        >
      | undefined
    /** Source used to preserve initialization-sensitive binding reads. */
    readonly source: string
    /** Validated ordered style bodies. */
    readonly styles: readonly Style.NamedStyle[]
  }
}

function immutable(style: Style.NamedStyle): Style.NamedStyle {
  if (Object.isFrozen(style)) return style
  return Object.freeze({
    ...style,
    declarations: Object.freeze([...style.declarations]),
    ...(style.rules
      ? {
          rules: Object.freeze(
            style.rules.map((rule) =>
              Object.freeze({ ...rule, style: immutable(rule.style) }),
            ),
          ),
        }
      : {}),
  })
}
