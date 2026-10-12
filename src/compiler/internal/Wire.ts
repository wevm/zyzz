/**
 * Decodes Rust `source.extract` results into the frozen data `Source.extract` returns.
 * The format is documented in `crates/compiler/src/compiler/internal/wire.rs`.
 * @module
 */
import * as Authoring from '../../internal/Authoring.js'
import * as Binding from '../../internal/Binding.js'
import type * as Block from '../../web/internal/Block.js'
import * as ClassName from '../../web/internal/ClassName.js'
import * as Configuration from '../../internal/Configuration.js'
import type * as Css from '../../web/Css.js'
import * as Identity from '../../internal/Identity.js'
import { MissingTransformError } from '../../styleFunction.js'
import type * as Query from '../../internal/Query.js'
import * as Source from '../Source.js'
import * as Style from '../../Style.js'
import * as Theme from '../../internal/Theme.js'
import * as Token from '../../internal/Token.js'
import * as Vars from '../../Vars.js'

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json }
type Pairs = readonly (readonly [string, Json])[]
type Fields = { readonly [key: string]: Json }

/** A failure encoded by the Rust compiler. */
type Failure = {
  readonly diagnostics?: readonly Fields[]
  readonly message: string
  readonly name: string
  readonly path?: readonly string[]
  readonly reason?: string
}

/**
 * Decodes one extraction result, or throws the error the extraction failed with.
 * @param text - JSON text returned by the `source.extract` operation.
 * @returns Frozen calls, styles, theme data, and contributions.
 * @throws {Source.ExtractError} With every source diagnostic of a failed extraction.
 */
export function decode(
  text: string,
  options: decode.Options = {},
): Source.extract.ReturnType {
  const output = JSON.parse(text) as {
    readonly contracts?: readonly Fields[]
    readonly error?: Failure
    readonly result?: Fields
  }

  if (output.error) throw failure(output.error)

  const contracts = (output.contracts ?? []).map(contract)
  const decoder = create(contracts, options)

  return decoder.result(output.result ?? {})
}

/** Extraction options that shape the decoded result. */
export declare namespace decode {
  /** The options passed to the extraction. */
  type Options = {
    /** `false` when the extraction collected portable identities without source rewriting. */
    readonly compiler?: boolean | undefined
  }
}

/** Reconstructs the error class a TypeScript extraction throws. */
function failure(error: Failure): Error {
  switch (error.name) {
    case 'Source.ExtractError':
      return new Source.ExtractError(
        (error.diagnostics ?? []).map((diagnostic) =>
          Object.freeze({
            code: diagnostic.code as Source.Diagnostic['code'],
            end: diagnostic.end as number,
            message: diagnostic.message as string,
            source: diagnostic.source as string,
            start: diagnostic.start as number,
          }),
        ),
      )
    case 'Config.InvalidError':
      return new Configuration.InvalidError(error.message)
    case 'Theme.InvalidError':
      return new Theme.InvalidError(
        error.path ?? [],
        error.reason ?? error.message,
      )
    case 'Vars.InvalidError':
      return new Vars.InvalidError(
        error.path ?? [],
        error.reason ?? error.message,
      )
    case 'Style.InvalidError':
      return new Style.InvalidError(
        (error.diagnostics ?? []).map((diagnostic) => {
          const location = diagnostic.location as Fields | undefined

          return Object.freeze({
            code: diagnostic.code as 'invalid_structure' | 'invalid_value',
            ...(location
              ? {
                  location: Object.freeze({
                    end: location.end as number,
                    path: Object.freeze([...(location.path as string[])]),
                    source: location.source as string,
                    start: location.start as number,
                  }),
                }
              : {}),
            message: diagnostic.message as string,
            path: Object.freeze([...(diagnostic.path as string[])]),
          }) as Style.Diagnostic
        }),
      )
    case 'MissingTransformError':
      return new MissingTransformError()
    default:
      return new Error(error.message)
  }
}

/** Rebuilds a contract with its enumerable properties in creation order. */
function contract(input: Fields): Token.Contract {
  const value: Record<string | symbol, unknown> = {}

  for (const key of input.keys as string[]) {
    if (key === 'variableSet') value.variableSet = true
    else if (key === 'mappings')
      value.mappings = (() => {
        if (input.mappings === undefined) return undefined
        if (input.mappings === false) return false
        return properties(input.mappings as Pairs)
      })()
    else if (key === 'shorthands')
      value.shorthands = shorthands(input.shorthands)
    else value[key] = input[key]
  }

  if (input.identity !== null) value[Token.identity] = input.identity
  if (input.complete) value[Token.complete] = true

  return Object.freeze(value) as Token.Contract
}

/** Shorthand mappings are frozen null-prototype records, as `Shorthands.read` returns them. */
function shorthands(
  input: Json | undefined,
): Readonly<Record<string, readonly string[]>> {
  return Object.freeze(lookup(input, strings))
}

/** A frozen record of frozen string lists. */
function properties(input: Pairs): Readonly<Record<string, readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      input.map(([key, value]) => [
        key,
        Object.freeze([...(value as string[])]),
      ]),
    ),
  )
}

function number(input: Json | undefined): number {
  if (typeof input === 'number') return input
  const tag = (input as Fields).n
  if (tag === 'NaN') return Number.NaN
  if (tag === 'Infinity') return Number.POSITIVE_INFINITY
  if (tag === '-Infinity') return Number.NEGATIVE_INFINITY
  return -0
}

function isNumber(input: Json | undefined): boolean {
  return (
    typeof input === 'number' ||
    (typeof input === 'object' &&
      input !== null &&
      !Array.isArray(input) &&
      'n' in input)
  )
}

function strings(input: Json | undefined): readonly string[] {
  return Object.freeze([...(input as string[])])
}

function record<value>(
  input: Json | undefined,
  decode: (value: Json) => value,
): Readonly<Record<string, value>> {
  return Object.freeze(
    Object.fromEntries(
      (input as Pairs).map(([key, value]) => [key, decode(value)]),
    ),
  )
}

/** Authored container names are frozen copies, and an omitted list is a fresh array. */
function containerNames(input: Json | undefined): readonly string[] {
  const names = input as string[]
  return names.length ? Object.freeze([...names]) : []
}

/** A mutable null-prototype record. */
function lookup<value>(
  input: Json | undefined,
  decode: (value: Json) => value,
): Record<string, value> {
  return Object.assign(
    Object.create(null) as Record<string, value>,
    Object.fromEntries(
      (input as Pairs).map(([key, value]) => [key, decode(value)]),
    ),
  )
}

/** Creates a decoder that shares one contract table. */
function create(contracts: readonly Token.Contract[], options: decode.Options) {
  function binding(input: Fields): Binding.Reference {
    const value = {
      name: input.name as `--${string}`,
      type: input.type as Binding.Domain,
      ...(input.zero ? { zero: true } : {}),
      variable: true as const,
    }

    return Object.freeze(
      input.dynamic
        ? Object.defineProperty(value, Binding.dynamic, { value: true })
        : value,
    ) as Binding.Reference
  }

  function reference(input: Fields): Token.Reference {
    const value = Token.create({
      contract: contracts[input.c as number]!,
      group: input.g as Token.Group,
      path: input.p as string,
      value: tokenValue(input.v) as Token.Value,
    })

    return input.w
      ? (Object.freeze({
          ...value,
          [Token.web]: true as const,
        }) as Token.Reference)
      : value
  }

  function expression(input: Fields): Token.Expression {
    const parts = Object.freeze(
      (input.parts as Json[]).map((part) => {
        if (typeof part === 'string') return part
        const fields = part as Fields
        if ('binding' in fields) return binding(fields.binding as Fields)
        return reference(fields.ref as Fields)
      }),
    )

    return Object.freeze(
      input.group === null
        ? { [Token.expression]: true as const, parts }
        : { [Token.expression]: true as const, group: input.group, parts },
    ) as Token.Expression
  }

  function tokenValue(input: Json | undefined): unknown {
    if (typeof input === 'string') return input
    if (isNumber(input)) return number(input)
    const fields = input as Fields
    if ('ref' in fields) return reference(fields.ref as Fields)
    if ('expr' in fields) return expression(fields.expr as Fields)
    return record(fields.obj!, tokenValue)
  }

  function data(input: Json | undefined): unknown {
    if (input === undefined) return undefined
    if (
      input === null ||
      typeof input === 'string' ||
      typeof input === 'boolean'
    )
      return input
    if (typeof input === 'number') return input
    if (Array.isArray(input)) return Object.freeze(input.map(data))
    const fields = input as Fields
    if ('n' in fields) return number(fields)
    if ('$' in fields) return undefined
    if ('ref' in fields) return reference(fields.ref as Fields)
    if ('expr' in fields) return expression(fields.expr as Fields)
    if ('binding' in fields) return binding(fields.binding as Fields)
    if ('theme' in fields) return definition(fields.theme as Fields)
    return record(fields.obj!, data)
  }

  // Authored configuration literals are mutable, and their objects have no prototype.
  function authored(input: Json | undefined): unknown {
    if (Array.isArray(input)) return input.map(authored)
    if (input === null || typeof input !== 'object') return data(input)
    const fields = input as Fields
    if (!('obj' in fields)) return data(input)
    return lookup(fields.obj, authored)
  }

  // Theme values flatten token groups into mutable records around the frozen token values.
  // A group is never a value, so an object with scheme or condition keys is one.
  function tree(input: Json | undefined): unknown {
    const fields = input as Fields | null
    const entries =
      fields !== null && typeof fields === 'object'
        ? (fields.obj as Pairs)
        : undefined
    if (
      !entries ||
      entries.some(
        ([key]) => key === 'default' || key === 'light' || key === 'dark',
      )
    )
      return data(input)
    return Object.fromEntries(entries.map(([key, value]) => [key, tree(value)]))
  }

  // Query metadata spreads over the token values of each configured theme.
  function themeValues(input: Json | undefined) {
    return Object.fromEntries(
      ((input as Fields).obj as Pairs).map(([key, value]) => {
        if (key === 'breakpoint' || key === 'container')
          return [key, Object.freeze(lookup((value as Fields).obj, String))]
        if (key === 'containerNames') return [key, containerNames(value)]
        return [key, tree(value)]
      }),
    )
  }

  // Normalized configuration options keep authored literals beside the flattened themes.
  function configOptions(input: Json | undefined): Record<string, unknown> {
    return Object.fromEntries(
      ((input as Fields).obj as Pairs).map(([key, value]) => {
        if (key === 'theme') return [key, themeValues(value)]
        if (key === 'themes')
          return [
            key,
            Object.fromEntries(
              ((value as Fields).obj as Pairs).map(([name, theme]) => [
                name,
                themeValues(theme),
              ]),
            ),
          ]
        return [key, authored(value)]
      }),
    )
  }

  function definition(input: Fields): Theme.Definition {
    const contract = contracts[input.contract as number]!
    const queries = input.queries as Fields | null
    const metadata = Object.freeze({
      contract,
      ...(input.cssName !== null ? { cssName: input.cssName as string } : {}),
      ...(input.paths !== null
        ? { paths: properties(input.paths as Pairs) }
        : {}),
      values: record(input.values, tokenValue) as Token.Metadata['values'],
      // Variable sets always record their query metadata, even when it is empty.
      ...(contract.variableSet && !queries ? { queries: undefined } : {}),
      ...(queries
        ? {
            queries: Object.freeze({
              breakpoint: Object.freeze(lookup(queries.breakpoint, String)),
              containerNames: containerNames(queries.containerNames),
              container: Object.freeze(lookup(queries.container, String)),
            }) as Query.Metadata,
          }
        : {}),
    })
    const className = input.className as Fields
    const value: Theme.Definition = Object.freeze(
      Object.defineProperty(
        {
          get className(): string {
            if ('ok' in className) return className.ok as string
            if (className.error === new MissingTransformError().message)
              throw new MissingTransformError()
            throw new Error(className.error as string)
          },
          style: (styles?: unknown, options: Record<string, unknown> = {}) => {
            if (!contract[Token.identity])
              Identity.requireId(undefined, 'Theme.define')
            return Authoring.create(styles, {
              ...options,
              theme: value,
            } as never)
          },
          tokens: data(input.tokens),
          variants: (
            styles: Record<string, unknown>,
            options: Record<string, unknown> = {},
          ) => Authoring.variants(styles, options as never),
          vars: data(input.vars),
        },
        Token.definition,
        { value: metadata },
      ),
    ) as unknown as Theme.Definition

    return value
  }

  function declarationValue(input: Json): Style.Declaration['value'] {
    return data(input) as Style.Declaration['value']
  }

  function style(input: Fields): Style.NamedStyle {
    const declarations = Object.freeze(
      (input.declarations as Json[][]).map(([property, value, important]) =>
        Object.freeze({
          ...(important ? { important: true } : {}),
          property: property as Style.Declaration['property'],
          value: declarationValue(value!),
        }),
      ),
    )
    const rules = input.rules as Json[][] | undefined
    const targets = input.targets as Fields | undefined
    const body = rules
      ? {
          name: input.name as string,
          declarations,
          rules: Object.freeze(
            rules.map(([condition, child]) =>
              Object.freeze({
                ...(condition !== null
                  ? { condition: condition as string }
                  : {}),
                style: style(child as Fields),
              }),
            ),
          ),
        }
      : { declarations, name: input.name as string }

    return Object.freeze({
      ...body,
      ...(targets
        ? {
            targets: Object.freeze({
              ...(targets.native !== undefined
                ? { native: target(targets.native) }
                : {}),
              ...(targets.ios !== undefined
                ? { ios: target(targets.ios) }
                : {}),
              ...(targets.android !== undefined
                ? { android: target(targets.android) }
                : {}),
              ...(targets.web !== undefined
                ? { web: style(targets.web as Fields) }
                : {}),
            }),
          }
        : {}),
      ...(input.composition !== undefined
        ? { composition: input.composition }
        : {}),
      ...(input.cssOutput !== undefined ? { cssOutput: input.cssOutput } : {}),
    }) as Style.NamedStyle
  }

  // Native target data is copied into frozen null-prototype records, as `Targets.copy` does.
  function target(input: Json | undefined): unknown {
    if (Array.isArray(input)) return Object.freeze(input.map(target))
    if (input === null || typeof input !== 'object' || !('obj' in input))
      return data(input)
    return Object.freeze(lookup((input as Fields).obj, target))
  }

  function styles(input: Fields): Style.Definition {
    return Object.freeze({
      styles: Object.freeze((input.styles as Fields[]).map(style)),
    })
  }

  // Compositions copy the styles they combine, and a copy differs from its source in content.
  function composed(
    input: Fields,
    sources: ReadonlyMap<string, string>,
  ): Style.NamedStyle {
    const decoded = style(input)
    const rules = input.rules as Json[][] | undefined
    const name = input.name as string

    if (!rules || !decoded.rules) return decoded

    const copied = (child: Fields) =>
      sources.get(child.name as string) !== JSON.stringify(child)

    // Runtime compositions copy each conditional rule with the output mode of its source.
    if (name.startsWith('composition-'))
      return Object.freeze({
        ...decoded,
        rules: Object.freeze(
          decoded.rules.map((rule, index) => {
            const child = rules[index]![1] as Fields
            return copied(child) && !('cssOutput' in rule.style)
              ? Object.freeze({
                  ...rule,
                  style: Object.freeze({ ...rule.style, cssOutput: undefined }),
                })
              : rule
          }),
        ),
      })

    // Static compositions copy referenced styles mutably beside their inline parts.
    if (
      decoded.declarations.length ||
      rules.some(([condition]) => condition !== null)
    )
      return decoded

    return Object.freeze({
      ...decoded,
      rules: Object.freeze(
        decoded.rules.map((rule) =>
          rule.style.name === name
            ? rule
            : Object.freeze({ ...rule, style: { ...rule.style } }),
        ),
      ),
    })
  }

  function labelled(input: Fields): Style.Definition {
    const inputs = input.styles as Fields[]
    const sources = new Map(
      inputs.map((entry) => [entry.name as string, JSON.stringify(entry)]),
    )
    const definition: Record<string | symbol, unknown> = {
      styles: Object.freeze(inputs.map((entry) => composed(entry, sources))),
    }
    const labels = input.labels as Json[][] | undefined

    if (labels)
      Object.defineProperty(definition, ClassName.labels, {
        value: Object.freeze(
          Object.fromEntries(
            labels.map(([name, label, namespace]) => [
              name,
              { name: label, namespace: namespace ?? undefined },
            ]),
          ),
        ),
      })

    return Object.freeze(definition) as Style.Definition
  }

  // A call's lowered recipe shares the axes and defaults of its recipe metadata.
  function staticRecipe(
    input: Fields,
    shared: ReturnType<typeof recipe> | undefined,
  ) {
    return {
      axes:
        shared?.axes ??
        lookup(input.axes, (choices) => [...(choices as string[])]),
      defaults: shared?.defaults ?? lookup(input.defaults, (value) => value),
      rules: (input.rules as Fields[]).map((rule) => ({
        matches: (rule.matches as Pairs).map(([axis, choices]) => [
          axis,
          [...(choices as string[])],
        ]),
        value: styles(rule.value as Fields),
      })),
    }
  }

  // Recipe metadata is mutable and keyed by null-prototype records, as `Recipes.expand` builds it.
  function recipe(input: Fields) {
    return {
      axes: lookup(input.axes, (choices) => [...(choices as string[])]),
      defaults: lookup(input.defaults, (value) => value),
      ...(input.payloads !== undefined
        ? {
            payloads: (input.payloads as Fields[]).map((payload) => ({
              axis: payload.axis as string,
              choice: payload.choice as string,
              slots: (payload.slots as Pairs[]).map((slots) =>
                Object.fromEntries(slots),
              ),
            })),
            defaultPayloads: lookup(input.defaultPayloads, (fields) =>
              lookup(fields, (value) =>
                isNumber(value) ? number(value) : value,
              ),
            ),
          }
        : {}),
      ...(input.conditions !== undefined
        ? { conditions: [...(input.conditions as string[])] }
        : {}),
    }
  }

  function slots(input: Json | undefined) {
    return record(input, (value) => binding(value as Fields))
  }

  // Callback slots are null-prototype records, so field names never meet inherited keys.
  function fields(input: Json | undefined) {
    return Object.freeze(
      Object.assign(
        Object.create(null) as Record<string, Binding.Reference>,
        Object.fromEntries(
          (input as Pairs).map(([key, value]) => [
            key,
            binding(value as Fields),
          ]),
        ),
      ),
    )
  }

  function nativeContext(input: Fields) {
    return Object.freeze({
      defaultVars: input.defaultVars as string,
      vars: record(input.vars, (value) => definition(value as Fields)),
    })
  }

  function owner(input: Fields) {
    return Object.freeze({
      attributes: strings(input.attributes),
      identity: input.identity as string,
      slots: strings(input.slots),
    })
  }

  function counts(input: Json | undefined): ReadonlyMap<number, number> {
    return new Map(
      (input as [number, number][]).map(([start, count]) => [start, count]),
    )
  }

  function call(input: Fields): Source.Call {
    const value: Record<string, unknown> = {}
    const shared =
      input.recipe !== undefined ? recipe(input.recipe as Fields) : undefined

    // Without source rewriting, every definition call records its portable identity, if any.
    if (
      options.compiler === false &&
      input.composition === undefined &&
      input.runtimeComposition === undefined &&
      input.compositionCase === undefined
    )
      value.portable = undefined

    for (const [key, entry] of Object.entries(input)) {
      switch (key) {
        case 'nativeContext':
          value[key] = nativeContext(entry as Fields)
          break
        case 'cssNamespace':
          value[key] = entry ?? undefined
          break
        case 'portable':
          value[key] = entry ?? undefined
          break
        // Composition metadata is assembled as mutable lists.
        case 'portableInputs':
        case 'compositionCases':
        case 'composition':
          value[key] = [...(entry as string[])]
          break
        case 'ownership':
          value[key] = owner(entry as Fields)
          break
        case 'runtimeComposition':
          value[key] = (entry as Fields[]).map((input) => ({
            ...(input.applicationStart !== undefined
              ? { applicationStart: input.applicationStart as number }
              : {}),
            ...(input.condition !== undefined
              ? { condition: input.condition as number }
              : {}),
            end: input.end as number,
            name: input.name as string,
            owners: (input.owners as Fields[]).map((owner) => ({
              attributes: [...(owner.attributes as string[])],
              identity: owner.identity as string,
              slots: [...(owner.slots as string[])],
            })),
            start: input.start as number,
          }))
          break
        case 'recipe':
          value[key] = shared
          break
        case 'dynamicRecipe':
        case 'staticRecipe':
          value[key] = staticRecipe(entry as Fields, shared)
          break
        case 'recipeTypes':
          value[key] = lookup(entry, (choices) => lookup(choices, String))
          break
        case 'shorthands':
          value[key] = shorthands(entry)
          break
        case 'typography':
        case 'typographyQueries':
          value[key] = counts(entry)
          break
        case 'slots':
          value[key] = fields(entry)
          break
        default:
          value[key] = entry
      }
    }

    return Object.freeze(value) as Source.Call
  }

  function signature(input: Fields) {
    return {
      // Parameters are the evaluated literal records, which have no prototype.
      parameters: (input.parameters as Fields[]).map((parameter) =>
        Object.assign(Object.create(null) as Record<string, unknown>, {
          ...(parameter.default !== undefined
            ? {
                default: isNumber(parameter.default)
                  ? number(parameter.default)
                  : parameter.default,
              }
            : {}),
          name: parameter.name,
          ...(parameter.syntax !== undefined
            ? { syntax: parameter.syntax }
            : {}),
        }),
      ),
      returns: input.returns,
    }
  }

  // Authored variable mappings stay the mutable null-prototype literal the configuration read.
  function mappings(
    input: Json | undefined,
  ): Source.extract.ReturnType['themeCalls'][number]['variableMappings'] {
    if (input === null || input === undefined) return undefined
    if (input === false) return false
    return lookup(input, (properties) => [
      ...(properties as string[]),
    ]) as NonNullable<
      Source.extract.ReturnType['themeCalls'][number]['variableMappings']
    >
  }

  // Configuration calls carry `appearance` and stay mutable. Factory calls are frozen.
  function themeCall(
    input: Fields,
  ): Source.extract.ReturnType['themeCalls'][number] {
    const value: Record<string, unknown> = {}

    for (const [key, entry] of Object.entries(input)) {
      // Variable configurations always record their mappings, even when none were authored.
      if (
        key === 'variableMappings' &&
        (input.variableConfig || entry === false)
      ) {
        value[key] = mappings(entry)
        continue
      }

      if (entry === null || entry === false) continue

      switch (key) {
        case 'function':
          value[key] = signature(entry as Fields)
          break
        case 'members':
          value[key] = input.appearance
            ? Object.fromEntries(entry as Pairs)
            : record(entry, String)
          break
        case 'options':
          value[key] = configOptions(entry)
          break
        case 'variables':
          value[key] = slots(entry)
          break
        default:
          value[key] = entry
      }
    }

    return (
      input.appearance ? value : Object.freeze(value)
    ) as Source.extract.ReturnType['themeCalls'][number]
  }

  function alias(
    input: Fields,
  ): Source.extract.ReturnType['themeAliases'][number] {
    const call = input.call as Fields

    // A style alias copies a fixed set of the theme call's fields, defined or not.
    if (input.bindings !== null)
      return {
        recipe: call.recipe as boolean,
        destructured: input.destructured as boolean,
        end: call.end as number,
        name: call.name as string,
        start: call.start as number,
        tokenType: call.tokenType as string,
        type: (call.type ?? undefined) as string | undefined,
        options:
          call.options === null ? undefined : configOptions(call.options),
        variableConfig: call.variableConfig ? true : undefined,
        variableMappings: mappings(call.variableMappings),
        output: (call.output ?? undefined) as 'html' | undefined,
        bindings: [...(input.bindings as ('style' | 'variants')[])],
      }

    return {
      ...themeCall(call),
      destructured: input.destructured as boolean,
      ...(input.retained ? { retained: true } : {}),
    } as Source.extract.ReturnType['themeAliases'][number]
  }

  function varsRead(
    input: Fields,
  ): NonNullable<Source.extract.ReturnType['nativeVars']>[number] {
    return {
      defaultVars: input.defaultVars as string,
      end: input.end as number,
      owner: input.owner as string,
      start: input.start as number,
      unnamed: input.unnamed as boolean,
      vars: Object.fromEntries(
        (input.vars as Pairs).map(([key, value]) => [
          key,
          definition(value as Fields),
        ]),
      ),
    }
  }

  // Contribution data is mutable. Only the styles `Style.define` produces inside it are frozen.
  function entry(input: Fields): Block.Entry {
    if (input.kind === 'block')
      return {
        kind: 'block',
        header: input.header as string,
        entries: (input.entries as Fields[]).map(entry),
      }
    if (input.kind === 'descriptor')
      return {
        kind: 'descriptor',
        name: input.name as string,
        value: (isNumber(input.value!) ? number(input.value!) : input.value) as
          | string
          | number,
      }
    return { kind: 'style', style: style(input.style as Fields) }
  }

  function scalarRecord(input: Json | undefined) {
    return Object.fromEntries(
      (input as Pairs).map(([key, value]) => [
        key,
        isNumber(value) ? number(value) : value,
      ]),
    ) as Record<string, string | number>
  }

  // Grouping rules nest plain `global` styles around the defined styles of their selectors.
  function ruleStyle(input: Fields): Style.NamedStyle {
    if (input.name !== 'global') return style(input)

    return {
      name: 'global',
      declarations: [],
      rules: ((input.rules as Json[][] | undefined) ?? []).map(
        ([condition, child]) => ({
          condition: condition as string,
          style: ruleStyle(child as Fields),
        }),
      ),
    }
  }

  function contribution(input: Fields): Css.Contribution {
    const value = ((): Record<string, unknown> => {
      switch (input.kind) {
        case 'block':
          return {
            kind: 'block',
            header: input.header,
            entries: (input.entries as Fields[]).map(entry),
          }
        case 'descriptor':
          return {
            kind: 'descriptor',
            rule: input.rule,
            name: input.name,
            declarations: scalarRecord(input.declarations),
          }
        case 'font-face':
          return {
            kind: 'font-face',
            declarations: scalarRecord(input.declarations),
          }
        case 'keyframes':
          return {
            kind: 'keyframes',
            name: input.name,
            frames: (input.frames as Fields[]).map((frame) => ({
              stop: frame.stop as string,
              style: style(frame.style as Fields),
            })),
          }
        case 'layers':
          return { kind: 'layers', names: [...(input.names as string[])] }
        case 'rule':
          return {
            kind: 'rule',
            selector: input.selector,
            style: ruleStyle(input.style as Fields),
          }
        default:
          return Object.fromEntries(
            Object.entries(input).filter(([key]) => key !== 'within'),
          )
      }
    })()

    return (
      input.within !== undefined
        ? { ...value, within: [...(input.within as string[])] }
        : value
    ) as Css.Contribution
  }

  function contributionCall(
    input: Fields,
  ): NonNullable<Source.extract.ReturnType['contributionCalls']>[number] {
    return {
      kind: input.kind,
      start: input.start,
      end: input.end,
      ...(input.function !== undefined
        ? { function: signature(input.function as Fields) }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.binding !== undefined ? { binding: input.binding } : {}),
      ...(input.exported !== undefined ? { exported: input.exported } : {}),
    } as NonNullable<Source.extract.ReturnType['contributionCalls']>[number]
  }

  function result(input: Fields): Source.extract.ReturnType {
    const contributions = (
      (input.contributions as Fields[] | undefined) ?? []
    ).map(contribution)
    // Namespaces are the namespace contributions themselves, as a filtered list.
    const value: Record<string, unknown> = {
      namespaces: contributions.filter((entry) => entry.kind === 'namespace'),
    }

    if (input.contributions !== undefined) {
      value.contributions = contributions
      value.contributionStarts = [...(input.contributionStarts as number[])]
    }

    if (input.contributionCalls !== undefined)
      value.contributionCalls = (input.contributionCalls as Fields[]).map(
        contributionCall,
      )

    value.calls = Object.freeze((input.calls as Fields[]).map(call))
    value.styles = labelled(input.styles as Fields)

    if (input.variableCalls !== undefined)
      value.variableCalls = Object.freeze(
        (input.variableCalls as Fields[]).map((entry) =>
          Object.freeze({
            explicit: entry.explicit as boolean,
            start: entry.start as number,
            end: entry.end as number,
            slots: slots(entry.slots),
          }),
        ),
      )

    value.themeAliases = Object.freeze(
      (input.themeAliases as Fields[]).map(alias),
    )

    for (const key of ['themeAppearances', 'themeScripts', 'themeSelections'])
      if (input[key] !== undefined) value[key] = strings(input[key]!)

    value.themeCalls = Object.freeze(
      (input.themeCalls as Fields[]).map(themeCall),
    )

    if (input.staticThemeReferences !== undefined)
      value.staticThemeReferences = Object.freeze(
        (input.staticThemeReferences as Fields[]).map((entry) => ({
          ...entry,
        })),
      )

    value.themeReferences = Object.freeze(
      (input.themeReferences as Fields[]).map((entry) =>
        Object.freeze({ ...entry }),
      ),
    )
    // Collected themes are keyed by a null-prototype record. A module without theme
    // imports collects none and returns an ordinary empty record.
    value.vars = Object.freeze(
      input.collectedThemes
        ? lookup(input.vars, (entry) => definition(entry as Fields))
        : {},
    )

    if (input.nativeVars !== undefined)
      value.nativeVars = Object.freeze(
        (input.nativeVars as Fields[]).map(varsRead),
      )

    return Object.freeze(value) as unknown as Source.extract.ReturnType
  }

  return { result }
}
