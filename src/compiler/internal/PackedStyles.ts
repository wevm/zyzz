/** Preserves ordered style bodies and runtime ownership across package boundaries. @module */
import type * as Recipe from '../../internal/Recipe.js'
import type * as RuntimeRecipe from '../../runtime/Recipe.js'
import * as Targets from '../../internal/Targets.js'
import * as Binding from '../../internal/Binding.js'
import * as Condition from '../../internal/Condition.js'
import * as ConditionalRecipe from '../../runtime/ConditionalRecipe.js'
import * as Literal from '../../internal/Literal.js'
import type * as Source from '../Source.js'
import type * as Style from '../../Style.js'
import type * as Theme from '../../Theme.js'
import * as Token from '../../internal/Token.js'

/** Portable composition inputs; selection behavior remains in the compiled callable. */
export type Definition = {
  /** Runtime scalar slots retained without executable callback bodies. */
  readonly dynamic?:
    | {
        readonly recipe: Recipe.Definition
        readonly slots: NonNullable<Source.Call['slots']>
        readonly payloads?: RuntimeRecipe.Definition['payloads']
        readonly defaultPayloads?: RuntimeRecipe.Definition['defaultPayloads']
      }
    | undefined
  /** Exact published classes replaced by a composition. Filled by graph emission. */
  readonly className?: string | undefined
  /** Attributes owned by the callable, including conditional selections. */
  readonly attributes: readonly string[]
  /** Native HTML output; React props are the default. */
  readonly output?: 'html' | undefined
  /** Private dynamic custom properties owned by the callable. */
  readonly slots: readonly string[]
  /** Target-neutral finite recipe retained for native consumers. */
  readonly staticRecipe?: Recipe.Definition | undefined
  /** Complete finite alternatives in authored cascade order. */
  readonly style: Style.NamedStyle
}

/** Captures ownership without retaining source ASTs or executable expressions. */
export function create(call: Source.Call, style: Style.NamedStyle): Definition {
  return {
    ...(call.slots || call.dynamicRecipe
      ? {
          dynamic: {
            recipe: call.dynamicRecipe ?? {
              axes: {},
              defaults: {},
              rules: [{ matches: [], value: { styles: [style] } }],
            },
            slots: call.slots ?? {},
            payloads: call.recipe?.payloads,
            defaultPayloads: call.recipe?.defaultPayloads,
          },
        }
      : {}),
    attributes: Object.keys(call.recipe?.axes ?? {}).flatMap((axis) => [
      `data-${axis}`,
      ...(call.recipe?.conditions ?? []).map((_, condition) =>
        ConditionalRecipe.attribute({ axis, condition }),
      ),
    ]),
    ...(call.output ? { output: call.output } : {}),
    slots: [
      ...Object.values(call.slots ?? {}).map((slot) => slot.name),
      ...(call.recipe?.payloads ?? []).flatMap((payload) =>
        payload.slots.flatMap((slots) => Object.values(slots)),
      ),
    ],
    staticRecipe:
      call.staticRecipe ??
      (!call.slots && !call.recipe && call.output !== 'html'
        ? {
            axes: {},
            defaults: {},
            rules: [{ matches: [], value: { styles: [style] } }],
          }
        : undefined),
    style,
  }
}

/** Validates compiler data and restores live theme references without executing package code. */
export function read(
  value: unknown,
  themes: Readonly<Record<string, Theme.Definition>>,
  version = 17,
): Definition {
  const tokens = new Map<string, Token.Reference>()
  function collect(value: unknown) {
    if (Token.is(value)) {
      tokens.set(
        JSON.stringify([value.contract[Token.identity], value.path]),
        value,
      )
      // Catalog themes share identities and paths but retain distinct fallback values.
      tokens.set(
        JSON.stringify([
          value.contract[Token.identity],
          value.path,
          value.value,
        ]),
        value,
      )
      return
    }
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) collect(child)
  }
  for (const theme of Object.values(themes)) collect(theme.tokens)

  function scalar(value: unknown, depth = 0): Style.Declaration['value'] {
    if (depth > 64)
      throw new Error('Packed style expression exceeds 64 levels.')

    if (
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      return value
    const item = object(value)
    if (item.kind === 'token') {
      const token = tokens.get(
        JSON.stringify([
          item.identity,
          item.path,
          ...(Object.hasOwn(item, 'value') ? [item.value] : []),
        ]),
      )
      if (!token) throw new Error('Unknown packed style token.')
      return token
    }
    if (item.kind === 'expression') {
      const parts = array(item.parts).map((part) => scalar(part, depth + 1))
      if (
        parts.some(
          (part) => typeof part === 'number' || Token.isExpression(part),
        )
      )
        throw new Error('Invalid packed style expression.')
      return Token.compose(
        parts as readonly (string | Token.Reference | Binding.Reference)[],
      )
    }
    const binding = Object.freeze(item)
    if (Binding.is(binding) && /^--z-[a-zA-Z0-9_-]+$/.test(binding.name))
      return binding
    throw new Error('Invalid packed style value.')
  }

  function style(value: unknown, depth = 0): Style.NamedStyle {
    if (depth > 64) throw new Error('Packed style nesting exceeds 64 levels.')
    const item = object(value)
    if (item.targets !== undefined && version < 20)
      throw new Error('Target branches require contract version 20 or later.')
    if (
      item.cssOutput !== undefined &&
      item.cssOutput !== 'atomic' &&
      item.cssOutput !== 'grouped'
    )
      throw new Error('Invalid packed style CSS output mode.')
    return {
      ...(item.cssOutput
        ? { cssOutput: item.cssOutput as 'atomic' | 'grouped' }
        : {}),
      declarations: array(item.declarations).map((value) => {
        const declaration = object(value)
        const property = string(declaration.property)
        if (
          !Object.hasOwn(Literal.rules, property) &&
          !property.startsWith('--')
        )
          throw new Error('Invalid packed style property.')
        if (
          declaration.important !== undefined &&
          typeof declaration.important !== 'boolean'
        )
          throw new Error('Invalid packed style importance.')
        return {
          important: declaration.important,
          property,
          value: scalar(declaration.value),
        } as Style.Declaration
      }),
      name: string(item.name),
      ...(item.targets === undefined
        ? {}
        : {
            targets: (() => {
              const targets = object(item.targets)
              if (
                Object.keys(targets).some(
                  (key) => !['android', 'ios', 'native', 'web'].includes(key),
                )
              )
                throw new Error('Unknown packed style target.')
              return {
                ...(targets.android === undefined
                  ? {}
                  : {
                      android: Targets.copy(
                        object(targets.android),
                      ) as NonNullable<Style.NamedStyle['targets']>['android'],
                    }),
                ...(targets.ios === undefined
                  ? {}
                  : {
                      ios: Targets.copy(object(targets.ios)) as NonNullable<
                        Style.NamedStyle['targets']
                      >['ios'],
                    }),
                ...(targets.native === undefined
                  ? {}
                  : {
                      native: Targets.copy(
                        object(targets.native),
                      ) as NonNullable<Style.NamedStyle['targets']>['native'],
                    }),
                ...(targets.web === undefined
                  ? {}
                  : { web: style(targets.web, depth + 1) }),
              }
            })(),
          }),
      ...(item.rules === undefined
        ? {}
        : {
            rules: array(item.rules).map((value) => {
              const rule = object(value)
              const condition =
                rule.condition === undefined
                  ? undefined
                  : string(rule.condition)
              if (
                condition !== undefined &&
                !condition.startsWith('@') &&
                !Condition.nested(condition)
              )
                throw new Error('Invalid packed style condition.')
              return {
                ...(condition ? { condition } : {}),
                style: style(rule.style, depth + 1),
              }
            }),
          }),
    }
  }

  const item = object(value)
  if (version >= 17 && object(item.style).cssOutput === undefined)
    throw new Error('Missing packed style CSS output mode.')
  const attributes = array(item.attributes).map(string)
  const slots = array(item.slots).map(string)
  if (
    attributes.some((name) => !/^data-[a-zA-Z0-9_-]+$/.test(name)) ||
    slots.some((name) => !/^--z-[a-zA-Z0-9_-]+$/.test(name)) ||
    (item.output !== undefined && item.output !== 'html')
  )
    throw new Error('Invalid packed style ownership.')
  function readRecipe(input: unknown) {
    if (input === undefined) return undefined
    if (version < 21)
      throw new Error('Static recipes require contract version 21 or later.')
    const recipe = object(input)
    const axes = Object.fromEntries(
      Object.entries(object(recipe.axes)).map(([name, value]) => {
        const choices = array(value).map(string)
        if (
          !name ||
          new Set(choices).size !== choices.length ||
          !choices.length
        )
          throw new Error('Invalid packed recipe axis.')
        return [name, choices]
      }),
    )
    const defaults = Object.fromEntries(
      Object.entries(object(recipe.defaults)).map(([axis, choice]) => {
        if (
          !Object.hasOwn(axes, axis) ||
          (choice !== null && !axes[axis]!.includes(string(choice)))
        )
          throw new Error('Invalid packed recipe default.')
        return [axis, choice === null ? null : string(choice)]
      }),
    )
    const rules = array(recipe.rules).map((value) => {
      const rule = object(value)
      return {
        matches: array(rule.matches).map((value) => {
          const match = array(value)
          const axis = string(match[0])
          const choices = array(match[1]).map(string)
          if (
            match.length !== 2 ||
            !Object.hasOwn(axes, axis) ||
            !choices.length ||
            choices.some((choice) => !axes[axis]!.includes(choice))
          )
            throw new Error('Invalid packed recipe match.')
          return [axis, choices] as const
        }),
        value: {
          styles: array(object(rule.value).styles).map((value) => style(value)),
        },
      }
    })
    return { axes, defaults, rules }
  }
  const staticRecipe = readRecipe(item.staticRecipe)
  const dynamic = (() => {
    if (item.dynamic === undefined) return undefined
    if (version < 23)
      throw new Error('Dynamic native contracts require version 23 or later.')
    const entry = object(item.dynamic)
    const recipe = readRecipe(entry.recipe)
    if (!recipe) throw new Error('Missing packed dynamic recipe.')
    function fields(value: unknown): Record<string, string> {
      return Object.fromEntries(
        Object.entries(object(value)).map(([field, value]) => {
          const name = string(value)
          if (
            !field ||
            [
              '__proto__',
              'style',
              'className',
              'variables',
              'key',
              'ref',
            ].includes(field) ||
            !slots.includes(name)
          )
            throw new Error('Invalid packed dynamic slot.')
          return [field, name]
        }),
      )
    }
    const inputs = Object.fromEntries(
      Object.entries(object(entry.slots)).map(([field, value]) => {
        const reference = scalar(value)
        if (
          !Binding.is(reference) ||
          !['number', 'length'].includes(reference.type)
        )
          throw new Error('Invalid packed dynamic scalar.')
        fields({ [field]: reference.name })
        return [field, reference]
      }),
    )
    const seen = new Set<string>()
    const payloads =
      entry.payloads === undefined
        ? undefined
        : array(entry.payloads).map((value) => {
            const payload = object(value)
            const axis = string(payload.axis)
            const choice = string(payload.choice)
            const identity = JSON.stringify([axis, choice])
            if (!recipe.axes[axis]?.includes(choice) || seen.has(identity))
              throw new Error('Invalid packed dynamic choice.')
            seen.add(identity)
            return {
              axis,
              choice,
              slots: array(payload.slots).map(
                (value) => fields(value) as Record<string, `--${string}`>,
              ),
            }
          })
    if (payloads?.some((payload) => payload.slots.length !== 1))
      throw new Error('Native payloads require one unconditional slot map.')
    const defaultPayloads =
      entry.defaultPayloads === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(object(entry.defaultPayloads)).map(
              ([axis, value]) => {
                const payload = payloads?.find(
                  (payload) =>
                    payload.axis === axis &&
                    payload.choice === recipe.defaults[axis],
                )
                if (!payload) throw new Error('Invalid packed dynamic default.')
                const defaults = object(value)
                const expected = Object.keys(payload.slots[0]!)
                if (
                  Object.keys(defaults).length !== expected.length ||
                  expected.some((field) => !Object.hasOwn(defaults, field))
                )
                  throw new Error('Incomplete packed dynamic default.')
                return [
                  axis,
                  Object.fromEntries(
                    Object.entries(defaults).map(([field, value]) => {
                      if (
                        typeof value !== 'string' &&
                        (typeof value !== 'number' || !Number.isFinite(value))
                      )
                        throw new Error(
                          'Invalid packed dynamic default scalar.',
                        )
                      return [field, value]
                    }),
                  ),
                ]
              },
            ),
          )
    return { recipe, slots: inputs, payloads, defaultPayloads }
  })()
  return {
    ...(dynamic ? { dynamic } : {}),
    attributes,
    className: string(item.className),
    ...(item.output ? { output: 'html' } : {}),
    slots,
    staticRecipe,
    style: style(item.style),
  }
}

/** Encodes references as data while preserving declaration and condition order. */
export function write(definition: Definition): unknown {
  return JSON.parse(
    JSON.stringify(
      {
        ...definition,
        style: {
          ...definition.style,
          cssOutput: definition.style.cssOutput ?? 'atomic',
        },
      },
      (_, value: unknown) => {
        if (Token.is(value))
          return {
            identity: value.contract[Token.identity],
            kind: 'token',
            path: value.path,
            value: value.value,
          }
        if (Token.isExpression(value))
          return { kind: 'expression', parts: value.parts }
        return value
      },
    ),
  )
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a packed style array.')
  return value
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a packed style object.')
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('Expected a packed style string.')
  return value
}
