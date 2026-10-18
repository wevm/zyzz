/** Expands documented Base UI states for untransformed web authoring. @module */
import * as Attributes from './Attributes.generated.js'
import * as Style from '../../../Style.js'
import type { style } from '../../../styleFunction.js'
import * as Token from '../../../internal/Token.js'

type Attribute = {
  readonly attribute: string
  readonly presence: boolean
  readonly values: readonly string[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Style.InvalidError([
      {
        code: 'invalid_structure',
        message: 'Base UI styles require static object bodies.',
        path: [],
      },
    ])

  return value as Record<string, unknown>
}

function lower(input: unknown, depth = 0): Record<string, unknown> {
  if (depth > 64)
    throw new Style.InvalidError([
      {
        code: 'invalid_structure',
        message: 'Base UI style nesting exceeds 64 levels.',
        path: [],
      },
    ])

  const result: Record<string, unknown> = {}
  const insert = (selector: string, value: unknown) => {
    let key = selector
    let occurrence = 1
    // Distinct condition entries retain their position without changing specificity.
    while (Object.hasOwn(result, key))
      key = `${selector}/*base-ui-${occurrence++}*/`

    result[key] = lower(value, depth + 1)
  }

  for (const [key, value] of Object.entries(record(input))) {
    if (key === 'states') {
      for (const [name, body] of Object.entries(record(value))) {
        const attribute = (
          Attributes.attributes as Readonly<Record<string, Attribute>>
        )[name]
        if (!attribute)
          throw new Style.InvalidError([
            {
              code: 'invalid_structure',
              message: `Unknown Base UI state: ${name}.`,
              path: ['states', name],
            },
          ])

        const choices = Object.entries(record(body))
        // A few parts expose presence-only `instant`, others expose a finite value.
        // A shorthand can share a value key, but its scalar/token is not a declaration body.
        // The compiler checks the component-specific domain.
        if (
          attribute.presence &&
          !choices.some(
            (entry) =>
              attribute.values.includes(entry[0]) &&
              entry[1] !== null &&
              typeof entry[1] === 'object' &&
              !Array.isArray(entry[1]) &&
              !Token.is(entry[1]) &&
              !Token.isExpression(entry[1]),
          )
        ) {
          insert(`&[${attribute.attribute}]`, body)
          continue
        }

        for (const [choice, declarations] of choices) {
          if (!attribute.values.includes(choice))
            throw new Style.InvalidError([
              {
                code: 'invalid_structure',
                message: `Unknown Base UI state value: ${name}.${choice}.`,
                path: ['states', name, choice],
              },
            ])

          insert(`&[${attribute.attribute}="${choice}"]`, declarations)
        }
      }
    } else if (key === 'selectors') {
      for (const [selector, declarations] of Object.entries(record(value)))
        insert(selector, declarations)
    } else if (key.startsWith('@') || key.startsWith(':') || key.includes('&'))
      insert(key, value)
    else if (key === 'targets') {
      const targets = record(value)
      result[key] = Object.fromEntries(
        Object.entries(targets).map((entry) => [
          entry[0],
          entry[0] === 'web' ? lower(entry[1], depth + 1) : entry[1],
        ]),
      )
    } else result[key] = value
  }

  return result
}

/** Adds component-first static authoring without loading or registering components. */
export function bind(factory: bind.Factory): bind.Factory {
  return (...args) => {
    const first = args[0]
    const component =
      args.length >= 2 &&
      first !== null &&
      typeof first === 'object' &&
      '$$typeof' in first
    if (!component) return factory(...args)

    return factory(lower(args[1]), args[2])
  }
}

/** Runtime callable boundary. Public authoring retains its overloads separately. */
export declare namespace bind {
  /** Style implementation accepting the existing authoring arguments. */
  type Factory = (...args: readonly unknown[]) => style.ReturnType<style.Output>
}
