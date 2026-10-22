/** Binds authored style data to extracted stylesheets without inserting CSS. @module */
import type { style } from '../styleFunction.js'
import * as Html from '../runtime/CompositionHtml.js'
import * as Identity from './Identity.js'
import * as Props from '../runtime/Props.js'
import * as Recipe from '../runtime/Recipe.js'
import * as Token from './Token.js'
import * as Style from '../Style.js'
import type * as Theme from './Theme.js'

/** Private ownership used by uncompiled composition; never spread onto DOM props. */
export const metadata = Symbol.for('zyzz.authoring')

// Static definitions retain their style data so later compositions can read it,
// including definitions created by another bundled copy of the runtime.
const data = Symbol.for('zyzz.style')

/** Identity and replaceable attribute, choice-class, and slot ownership for an applied definition. */
export type Owner = {
  readonly name: string
  readonly attributes: readonly string[]
  readonly prefixes?: readonly string[] | undefined
  readonly slots: readonly string[]
}

/** Attaches authoring ownership without adding enumerable props. */
export function bind<value extends object>(
  value: value,
  owners: readonly Owner[],
): value {
  Object.defineProperty(value, metadata, { value: owners })
  return value
}

/** Authoring identity, output convention, and optional token context. */
export type Options = {
  readonly id?: string | undefined
  readonly output?: style.Output | undefined
  readonly theme?: Theme.Definition | undefined
}

/** Expands selector and variable containers without changing declaration order. */
export function body(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (key === 'targets') {
        if (!value || typeof value !== 'object') return [[key, value]]
        const descriptors = Object.getOwnPropertyDescriptors(value)
        const web = descriptors.web
        if (web && 'value' in web && web.value && typeof web.value === 'object')
          descriptors.web = { ...web, value: body(web.value) }
        return [[key, Object.create(Object.getPrototypeOf(value), descriptors)]]
      }
      if (key === 'selectors' || key === 'vars')
        return Object.entries(value as Record<string, unknown>).map(
          ([name, entry]) => [
            name,
            key === 'selectors'
              ? body(entry as Record<string, unknown>)
              : entry,
          ],
        )
      if (key.startsWith('@') || key.startsWith(':') || key.includes('&'))
        return [[key, body(value as Record<string, unknown>)]]
      return [[key, value]]
    }),
  )
}

/** Creates spreadable props using content identities or an explicit definition identity. */
export function create(
  input: unknown = {},
  options: Options = {},
): style.ReturnType {
  const dynamic = typeof input === 'function'
  const identity = options.theme?.[Token.definition].contract[Token.identity]
  const namespace = identity?.startsWith('id-') ? identity.slice(3) : undefined
  const id =
    options.id === undefined
      ? undefined
      : `id-${namespace ? `${namespace}-` : ''}${Identity.requireId(options.id, 'style').slice(3)}`
  if (dynamic && !id) Identity.requireId(undefined, 'Dynamic style')
  if (!dynamic && !id && Object.keys(input as object).length === 0)
    Identity.requireId(undefined, 'Empty style')

  const define = (input: unknown) =>
    (
      Style.define as (
        input: Record<string, unknown>,
        options: Style.define.Options,
      ) => Style.Definition
    )(
      { style: body(input as Record<string, unknown>) },
      { vars: options.theme },
    ).styles[0]!

  const style = (() => {
    if (dynamic) return undefined
    if (!Array.isArray(input)) return define(input)

    // Mirrors compiled composition: each entry is one ordered declaration segment.
    const rules: Style.Rule[] = []
    for (const [index, entry] of (input as readonly unknown[]).entries()) {
      if (typeof entry !== 'function') {
        rules.push({ style: define(entry) })
        continue
      }

      const style = Object.getOwnPropertyDescriptor(entry, data)?.value as
        | Style.NamedStyle
        | undefined
      if (style) {
        rules.push({ style })
        continue
      }

      // Compiled callables carry only class names, so an explicit id names the composite.
      if (id) return undefined

      throw new Style.InvalidError([
        {
          code: 'invalid_structure',
          message:
            'Composition entries require literal objects or static style definitions. Compositions of compiled definitions require an explicit id, and variants and dynamic styles are applied with cx.',
          path: [String(index)],
        },
      ])
    }

    return { name: 'style', declarations: [], rules } satisfies Style.NamedStyle
  })()

  const className = id ? `z-style-${id}` : Identity.style(style!, namespace)
  const props = Props.create({ className })
  const apply = (values?: style.Options & Record<string, unknown>) => {
    let result = props(values as style.Options)
    if (dynamic) {
      const style: Record<string, string | number | undefined> = {
        ...result.style,
      }
      for (const [field, value] of Object.entries(values ?? {})) {
        if (['className', 'style', 'vars'].includes(field)) continue
        style[Identity.slot(id!, field)] =
          value === '' ? ' ' : (value as string | number)
      }
      result = { ...result, style }
    }
    return bind(options.output === 'html' ? Html.from(result) : result, [
      {
        name: className,
        attributes: [],
        slots: dynamic
          ? Object.keys(values ?? {})
              .filter((key) => !['className', 'style', 'vars'].includes(key))
              .map((key) => Identity.slot(id!, key))
          : [],
      },
    ])
  }
  Object.defineProperty(apply, Symbol.toPrimitive, {
    value: () => `.${className}`,
  })
  if (style) Object.defineProperty(apply, data, { value: style })
  return apply as style.ReturnType
}

/** Selects finite variants and binds dynamic payloads using explicit identities. */
export function variants(
  input: Record<string, unknown>,
  options: Options = {},
): unknown {
  const identity = options.theme?.[Token.definition].contract[Token.identity]
  const namespace = identity?.startsWith('id-') ? identity.slice(3) : undefined
  const id = `id-${namespace ? `${namespace}-` : ''}${Identity.requireId(options.id, 'variants').slice(3)}`
  if (options.theme) {
    const styles = [
      input.base,
      ...Object.values(
        (input.variants ?? {}) as Record<string, Record<string, unknown>>,
      ).flatMap(Object.values),
      ...((input.compoundVariants ?? []) as readonly { style: unknown }[]).map(
        (entry) => entry.style,
      ),
    ]
    for (const input of styles)
      if (input && typeof input === 'object')
        Style.define(
          { style: body(input as Record<string, unknown>) } as never,
          { vars: options.theme },
        )
  }
  const className = `z-style-${id}`
  const axes = Object.entries(
    (input.variants ?? {}) as Record<string, Record<string, unknown>>,
  )
  const conditions = Object.keys((input.conditions ?? {}) as object)
  const defaults = (input.defaultVariants ?? {}) as Record<string, unknown>
  const prefix = input.selection === 'class' ? Identity.recipe(id) : undefined
  const props = Props.create({ className })
  const starts = Recipe.offsets(
    Object.fromEntries(
      axes.map(([axis, choices]) => [axis, Object.keys(choices)]),
    ),
  )
  const compounds = (input.compoundVariants ?? []) as readonly {
    when: Record<string, unknown>
  }[]
  // Class selection names a choice by its axis and choice positions. An empty choice that no
  // compound names matches no rule, so its class is omitted, as compiled selection omits it.
  function marker(axis: string, value: unknown, condition?: number) {
    const index = axes.findIndex(([name]) => name === axis)
    const choices = axes[index]![1]
    const name = String(value)
    const position = Object.keys(choices).indexOf(name)
    const body = choices[name]
    const silent =
      typeof body === 'object' &&
      body !== null &&
      Object.keys(body).length === 0 &&
      !compounds.some((compound) =>
        ([] as unknown[])
          .concat(compound.when[axis])
          .some((choice) => String(choice) === name),
      )
    return position < 0 || silent
      ? ''
      : ` ${Recipe.choice({ condition, index: starts[index]! + position, prefix: prefix! })}`
  }

  return (values: Record<string, unknown> & style.Options = {}) => {
    const result = { ...props(values as style.Options) } as {
      className: string
      style?: NonNullable<style.Props['style']>
      [key: `data-${string}`]: string | undefined
    }
    const bindings: Record<string, string | number> = {}
    function select(axis: string, value: unknown, context: number): unknown {
      if (!value || typeof value !== 'object') return value
      const choice = Object.keys(value)[0]!
      const payload = (
        value as Record<string, Record<string, string | number>>
      )[choice]!
      const axisIndex = axes.findIndex(([name]) => name === axis)
      const choiceIndex = Object.keys(axes[axisIndex]![1]).indexOf(choice)
      for (const [field, value] of Object.entries(payload))
        bindings[
          Identity.slot(
            `${id}-${axisIndex + 1}-${choiceIndex}-${context}`,
            field,
          )
        ] = value === '' ? ' ' : value
      return choice
    }
    for (const [axis] of axes) {
      const value = select(
        axis,
        values[axis] === undefined ? defaults[axis] : values[axis],
        0,
      )
      if (value === undefined || value === null) continue

      if (prefix) result.className += marker(axis, value)
      else result[`data-${axis}`] = String(value)
    }
    const selected = values.conditions as
      | Record<string, Record<string, unknown>>
      | undefined
    for (const [index, name] of conditions.entries()) {
      const context = selected?.[name]
      if (!context) continue
      for (const [position, [axis]] of axes.entries()) {
        const value = select(axis, context[axis], index + 1)
        if (value === undefined) continue

        if (prefix)
          result.className += ` ${Recipe.overridden({ axis: position, condition: index, prefix })}${value === null ? '' : marker(axis, value, index)}`
        else
          result[`data-zyzz-condition-${index}-${axis}`] =
            value === null ? 'n' : `s${value}`
      }
    }
    if (Object.keys(bindings).length)
      result.style = { ...result.style, ...bindings }
    return bind(options.output === 'html' ? Html.from(result) : result, [
      {
        name: className,
        attributes: prefix
          ? []
          : axes.flatMap(([axis]) => [
              `data-${axis}`,
              ...conditions.map(
                (_, index) => `data-zyzz-condition-${index}-${axis}`,
              ),
            ]),
        ...(prefix ? { prefixes: [prefix] } : {}),
        slots: Object.keys(bindings),
      },
    ])
  }
}
