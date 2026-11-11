/** Expands documented Base UI and declared part states for untransformed web authoring. @module */
import * as Attributes from './Attributes.generated.js'
import * as Style from '../../../Style.js'
import type { style } from '../../../styleFunction.js'
import * as Token from '../../../internal/Token.js'

/** A declared part's frozen state descriptor, keyed by camelCase state name. */
export type Declared = Readonly<Record<string, 'boolean' | readonly string[]>>

/** Holds a declared part's descriptor. A registered symbol lets separate zyzz copies agree. */
export const states = Symbol.for('zyzz.base-ui.states')

type Attribute = {
  readonly attribute: string
  readonly domain?: 'number' | 'string'
  readonly presence: boolean
  readonly selector?: string
  readonly values: readonly string[]
}

// Matches css::string::encode so CSS-only identities agree with the compiler.
function quote(value: string): string {
  let result = '"'
  let spaceBeforeHex = false

  for (const code of value) {
    const point = code.codePointAt(0)!
    if (point === 0)
      throw new Style.InvalidError([
        {
          code: 'invalid_structure',
          message: 'Base UI state values cannot contain NUL.',
          path: [],
        },
      ])

    if (point <= 0x1f || point === 0x7f) {
      result += `\\${point.toString(16)}`
      spaceBeforeHex = true
    } else if (code === '"' || code === '\\') {
      result += `\\${code}`
      spaceBeforeHex = false
    } else {
      if (spaceBeforeHex && /[\da-fA-F\t\n\f\r ]/u.test(code)) result += ' '
      result += code
      spaceBeforeHex = false
    }
  }

  return `${result}"`
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

// Declared states follow the Base UI spelling: `popupOpen` becomes `data-popup-open`.
function declaredAttribute(
  declared: Declared,
  name: string,
): Attribute | undefined {
  const domain = Object.hasOwn(declared, name) ? declared[name] : undefined
  if (!domain) return undefined

  return {
    attribute: `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    presence: domain === 'boolean',
    values: domain === 'boolean' ? [] : domain,
  }
}

function lower(
  input: unknown,
  depth = 0,
  declared?: Declared | undefined,
): Record<string, unknown> {
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

    result[key] = lower(value, depth + 1, declared)
  }

  for (const [key, value] of Object.entries(record(input))) {
    if (key === 'states') {
      for (const [name, body] of Object.entries(record(value))) {
        const attribute = declared
          ? declaredAttribute(declared, name)
          : (Attributes.attributes as Readonly<Record<string, Attribute>>)[name]
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
          insert(attribute.selector ?? `&[${attribute.attribute}]`, body)
          continue
        }

        for (const [choice, declarations] of choices) {
          if (
            attribute.domain === 'number'
              ? !Number.isFinite(Number(choice)) ||
                String(Number(choice)) !== choice
              : attribute.domain !== 'string' &&
                !attribute.values.includes(choice)
          )
            throw new Style.InvalidError([
              {
                code: 'invalid_structure',
                message: `Unknown Base UI state value: ${name}.${choice}.`,
                path: ['states', name, choice],
              },
            ])

          insert(`&[${attribute.attribute}=${quote(choice)}]`, declarations)
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
          entry[0] === 'web' ? lower(entry[1], depth + 1, declared) : entry[1],
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
    if (
      args.length < 2 ||
      first === null ||
      (typeof first !== 'object' && typeof first !== 'function')
    )
      return factory(...args)

    // Declared parts may be plain functions, which a dynamic style callback also is.
    const declared = (first as { readonly [states]?: Declared })[states]
    if (declared) return factory(lower(args[1], 0, declared), args[2])
    if (typeof first === 'object' && '$$typeof' in first)
      return factory(lower(args[1]), args[2])

    return factory(...args)
  }
}

/** Runtime callable boundary. Public authoring retains its overloads separately. */
export declare namespace bind {
  /** Style implementation accepting the existing authoring arguments. */
  type Factory = (...args: readonly unknown[]) => style.ReturnType<style.Output>
}
