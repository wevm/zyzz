/** Preserves ordered style bodies and runtime ownership across package boundaries. @module */
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
  /** Exact published classes replaced by a composition. Filled by graph emission. */
  readonly className?: string | undefined
  /** Attributes owned by the callable, including conditional selections. */
  readonly attributes: readonly string[]
  /** Native HTML output; React props are the default. */
  readonly output?: 'html' | undefined
  /** Private dynamic custom properties owned by the callable. */
  readonly slots: readonly string[]
  /** Complete finite alternatives in authored cascade order. */
  readonly style: Style.NamedStyle
}

/** Captures ownership without retaining source ASTs or executable expressions. */
export function create(call: Source.Call, style: Style.NamedStyle): Definition {
  return {
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
      const token = tokens.get(JSON.stringify([item.identity, item.path]))
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
  return {
    attributes,
    className: string(item.className),
    ...(item.output ? { output: 'html' } : {}),
    slots,
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
