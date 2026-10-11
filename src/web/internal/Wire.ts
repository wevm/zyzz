/**
 * Encodes `Css.compile` input as the Rust compiler's JSON wire format and decodes its result.
 * The format is documented in `crates/zyzz_compiler/src/wire.rs`.
 * @module
 */
import * as Binding from '../../internal/Binding.js'
import * as Token from '../../internal/Token.js'
import type * as Style from '../../Style.js'
import * as Css from '../Css.js'
import type * as Block from './Block.js'
import * as ClassName from './ClassName.js'
import type * as Contributions from './Contributions.js'
import * as Themes from './Themes.js'

/**
 * Encodes compiler input, listing each identity-compared object once in post order.
 * Reads own properties without invoking accessors on definitions and leaves inputs unchanged.
 * @param options - Input accepted by `Css.compile`.
 * @returns JSON text for the Rust compiler.
 */
export function encode(options: Css.compile.Options): string {
  const indexes = new Map<object, number>()
  const objects: unknown[] = []

  // Dependencies are encoded first, so every entry refers only to earlier entries.
  function add(key: object, entry: () => unknown): number {
    const previous = indexes.get(key)
    if (previous !== undefined) return previous

    const value = entry()

    indexes.set(key, objects.length)
    objects.push(value)

    return objects.length - 1
  }

  function contract(value: Token.Contract): number {
    return add(value, () => {
      const fields: Record<string, unknown> = { keys: Object.keys(value) }

      if (value[Token.complete]) fields.complete = true

      const identity = value[Token.identity]
      if (typeof identity === 'string') fields.identity = identity

      if (value.variableSet) fields.variableSet = true
      if (value.mappings !== undefined) fields.mappings = value.mappings
      if (typeof value.composition === 'string')
        fields.composition = value.composition
      if (typeof value.cssOutput === 'string')
        fields.cssOutput = value.cssOutput
      if (typeof value.defaultLayer === 'string')
        fields.defaultLayer = value.defaultLayer
      if (value.shorthands !== undefined) fields.shorthands = value.shorthands

      return ['c', fields]
    })
  }

  function reference(value: unknown): number {
    if (Binding.is(value))
      return add(value, () => [
        'b',
        value.name,
        value.type,
        value[Binding.dynamic] === true,
      ])

    if (Token.is(value))
      return add(value, () => [
        't',
        contract(value.contract),
        value.group,
        value.path,
        tokenValue(value.value),
        (value as Partial<Record<typeof Token.web, boolean>>)[Token.web] ===
          true,
      ])

    if (Token.isExpression(value))
      return add(value, () => [
        'e',
        Object.hasOwn(value, 'group')
          ? (value as unknown as Token.Composition).group
          : null,
        value.parts.map((part) =>
          typeof part === 'string' ? part : [reference(part)],
        ),
      ])

    throw new Error('Expected a binding, token reference, or expression.')
  }

  function number(value: number): unknown {
    return Number.isFinite(value) ? value : { n: String(value) }
  }

  function tokenValue(input: unknown): unknown {
    if (typeof input === 'string') return input
    if (typeof input === 'number') return number(input)
    if (Token.is(input) || Token.isExpression(input)) return [reference(input)]

    if (typeof input === 'object' && input !== null)
      return {
        r: Object.entries(input).map(([key, entry]) => [
          key,
          tokenValue(entry),
        ]),
      }

    return String(input)
  }

  // Values outside the declaration contract serialize as their template-literal text.
  function declarationValue(input: unknown): unknown {
    if (typeof input === 'string') return input
    if (typeof input === 'number') return number(input)

    if (Binding.is(input) || Token.is(input) || Token.isExpression(input))
      return [reference(input)]

    return String(input)
  }

  function theme(value: Token.Metadata): number {
    return add(value, () => [
      'm',
      contract(value.contract),
      value.cssName ?? null,
      Object.entries(value.values).map(([path, entry]) => [
        path,
        tokenValue(entry),
      ]),
      value.paths ?? null,
      value.queries ?? null,
    ])
  }

  function own(value: object, key: string): unknown {
    return Object.getOwnPropertyDescriptor(value, key)?.value
  }

  function style(input: Style.NamedStyle): unknown {
    const output: Record<string, unknown> = {
      d: input.declarations.map((declaration) => [
        declaration.property,
        declarationValue(declaration.value),
        declaration.important ? 1 : 0,
      ]),
      n: input.name,
    }

    if (input.rules)
      output.r = input.rules.map((rule) => [
        rule.condition === undefined ? null : String(rule.condition),
        style(rule.style),
      ])

    // Only own modes apply; inherited metadata is ignored.
    const cssOutput = own(input, 'cssOutput')
    if (cssOutput !== undefined)
      output.o = typeof cssOutput === 'string' ? cssOutput : false

    const composition = own(input, 'composition')
    if (composition !== undefined && composition !== null)
      output.c = typeof composition === 'string' ? composition : false

    if (input.targets) {
      const targets: Record<string, unknown> = {}

      for (const key of ['android', 'ios', 'native'] as const)
        if (input.targets[key] !== undefined) targets[key] = input.targets[key]

      if (input.targets.web) targets.web = style(input.targets.web)

      output.t = targets
    }

    return output
  }

  function scalar(value: string | number): unknown {
    return typeof value === 'number' && !Number.isFinite(value)
      ? String(value)
      : value
  }

  function entry(value: Block.Entry): unknown {
    if (value.kind === 'style')
      return { kind: 'style', style: style(value.style) }

    if (value.kind === 'block')
      return {
        entries: value.entries.map(entry),
        header: value.header,
        kind: 'block',
      }

    return { kind: 'descriptor', name: value.name, value: scalar(value.value) }
  }

  function contribution(value: Contributions.Definition): unknown {
    const within = value.within?.length ? { within: value.within } : {}

    switch (value.kind) {
      case 'block':
        return {
          entries: value.entries.map(entry),
          header: value.header,
          kind: value.kind,
          ...within,
        }
      case 'custom-media':
        return {
          kind: value.kind,
          name: value.name,
          query: String(value.query),
          ...within,
        }
      case 'descriptor':
        return {
          declarations: Object.entries(value.declarations).map(
            ([key, entry]) => [key, scalar(entry)],
          ),
          kind: value.kind,
          name: value.name,
          rule: value.rule,
          ...within,
        }
      case 'font-face':
        return {
          declarations: Object.entries(value.declarations).map(
            ([key, entry]) => [key, scalar(entry)],
          ),
          kind: value.kind,
          ...within,
        }
      case 'import':
        return {
          kind: value.kind,
          ...(value.layer === true
            ? { layer: true }
            : value.layer
              ? { layer: value.layer }
              : {}),
          ...(value.media ? { media: value.media } : {}),
          ...(value.supports ? { supports: value.supports } : {}),
          url: value.url,
          ...within,
        }
      case 'keyframes':
        return {
          frames: value.frames.map((frame) => [frame.stop, style(frame.style)]),
          kind: value.kind,
          name: value.name,
          ...within,
        }
      case 'layers':
        return { kind: value.kind, names: value.names, ...within }
      case 'namespace':
        return {
          kind: value.kind,
          name: value.name,
          ...(value.prefix === undefined ? {} : { prefix: value.prefix }),
          uri: value.uri,
          ...within,
        }
      case 'property':
        return {
          inherits: value.inherits,
          ...(value.initialValue === undefined
            ? {}
            : { initialValue: scalar(value.initialValue) }),
          kind: value.kind,
          name: value.name,
          syntax: value.syntax,
          ...within,
        }
      case 'rule':
        return {
          kind: value.kind,
          selector: value.selector,
          style: style(value.style),
          ...within,
        }
    }
  }

  // `??` treats null as absent for composition, while any present output mode is validated.
  function mode(value: unknown, nullable: boolean): unknown {
    if (value === undefined || (nullable && value === null)) return undefined
    return typeof value === 'string' ? value : false
  }

  const styles = options.styles.styles.map(style)
  const contributions = (options.contributions ?? []).map(contribution)
  const vars =
    options.vars &&
    Object.entries(options.vars).map(([name, value]) => {
      if (value === null || value === undefined) return [name, null]

      const metadata = Object.getOwnPropertyDescriptor(value, Token.definition)
        ?.value as Token.Metadata | undefined

      return [name, value && metadata ? theme(metadata) : false]
    })
  const labels = options[ClassName.labels] ?? options.styles[ClassName.labels]
  const units = options[ClassName.units]?.[ClassName.state]?.read()
  const shared = options[Themes.shared]
  const composition = mode(options.composition, true)
  const cssOutput = mode(options.cssOutput, true)

  return JSON.stringify({
    ...(composition === undefined ? {} : { composition }),
    ...(contributions.length ? { contributions } : {}),
    ...(cssOutput === undefined ? {} : { cssOutput }),
    ...(options.development ? { development: true } : {}),
    ...(labels
      ? {
          labels: Object.entries(labels).map(([name, label]) => [
            name,
            label?.name ?? null,
            label?.namespace ?? null,
          ]),
        }
      : {}),
    ...(options.names
      ? {
          names: Object.entries(options.names).filter(
            ([, id]) => typeof id === 'string',
          ),
        }
      : {}),
    objects,
    ...(options.schemes ? { schemes: true } : {}),
    ...(typeof options.scope === 'string' && options.scope
      ? { scope: options.scope }
      : {}),
    ...(shared ? { shared: shared === 'all' ? 'all' : 'defaults' } : {}),
    styles,
    ...(units
      ? {
          units: {
            names: units.names,
            owner: units.owner,
            qualifier: units.qualifier,
            visible: units.visible ?? null,
          },
        }
      : {}),
    ...(vars ? { vars } : {}),
  })
}

/** Decoded output fields, as the Rust compiler emits them. */
type Output = {
  readonly classes: Readonly<Record<string, string>>
  readonly contributionCss?: string | undefined
  readonly css: string
  readonly error?:
    | {
        readonly diagnostics?: readonly Css.Diagnostic[] | undefined
        readonly message: string
        readonly name: string
      }
    | undefined
  readonly rules: Readonly<Record<string, string>>
  readonly scopedCss?: string | undefined
  readonly shared?: readonly Themes.Resource[] | undefined
  readonly units: readonly (readonly [string, boolean, string])[]
  readonly vars: Readonly<Record<string, string>>
}

/**
 * Decodes a Rust compiler result into the frozen `Css.compile` result.
 * Records unit naming decisions in the supplied scope's shared table.
 * @param json - JSON text from the Rust compiler.
 * @param units - The scope whose table the compilation borrowed, when one was supplied.
 * @returns The same shape `Css.compile` returns.
 * @throws {Css.CompileError} When the compilation reported diagnostics.
 */
export function decode(
  json: string,
  units?: ClassName.Units | undefined,
): Css.compile.ReturnType {
  const output = JSON.parse(json) as Output

  if (output.error) {
    if (output.error.diagnostics)
      throw new Css.CompileError(output.error.diagnostics)
    throw new Error(output.error.message)
  }

  const used = new Map(
    output.units.map(([key, borrowed, name]) => [key, { borrowed, name }]),
  )

  units?.[ClassName.state]?.record(used)

  const result = {
    ...(output.shared ? { [Themes.shared]: output.shared } : {}),
    ...(output.contributionCss === undefined
      ? {}
      : {
          contributionCss: output.contributionCss,
          scopedCss: output.scopedCss,
        }),
    [ClassName.units]: units?.used ?? used,
    [ClassName.rules]: Object.freeze({ ...output.rules }),
    classes: Object.freeze(Object.assign(Object.create(null), output.classes)),
    css: output.css,
    vars: Object.freeze(Object.assign(Object.create(null), output.vars)),
  }

  Object.defineProperty(result, ClassName.rules, { enumerable: false })
  Object.defineProperty(result, ClassName.units, { enumerable: false })

  return Object.freeze(result) as Css.compile.ReturnType
}
