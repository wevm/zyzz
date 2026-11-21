/**
 * Declares data-attribute states on components outside the generated Base UI catalog,
 * so component-first `style` checks and lowers them like catalogued parts.
 * @module
 */
import * as Authoring from './internal/Authoring.js'
import * as Style from '../../Style.js'

/** Type-only key carrying declared state domains. The runtime descriptor uses a private symbol. */
export declare const marker: unique symbol

/**
 * A component type with declared states. `part` returns this type for its component.
 * A `boolean` state matches attribute presence, such as `data-open`. A string literal
 * union matches attribute values, such as `data-status="failed"`.
 * @example
 * ```ts
 * import type { Part } from 'zyzz/base-ui/react'
 *
 * // States compile to [data-open] and [data-status="..."] selectors.
 * type States = Part<{ open: boolean; status: 'running' | 'done' | 'failed' }>
 * ```
 */
export type Part<states extends Part.States> = {
  /** Declared state domains, absent at runtime. */
  readonly [marker]: states
}

/** Declared state contracts. */
export declare namespace Part {
  /** State domains by camelCase name: `boolean` for presence, string literals for values. */
  type States = { readonly [name: string]: boolean | string }
}

/**
 * Declares the states a component exposes as `data-*` attributes and returns the same
 * component. Each camelCase name maps to a kebab-case attribute, so `popupOpen` matches
 * `data-popup-open`. `'boolean'` states match presence. Arrays list the finite values.
 * The compiler reads the literal descriptor from the declaring module, its re-exports,
 * or a package contract, so `style(Component, { states })` emits CSS ahead of time.
 * @example
 * ```tsx
 * import { part } from 'zyzz/base-ui/react'
 *
 * // Renders data-open and data-status for component-first state styles.
 * export const Root = part(
 *   function Root(props: { className?: string; open: boolean; status: string }) {
 *     return <div className={props.className} data-open={props.open ? '' : undefined} data-status={props.status} />
 *   },
 *   { open: 'boolean', status: ['running', 'done', 'failed'] },
 * )
 * ```
 * @param component - The component that renders the declared attributes. It is returned unchanged apart from a non-enumerable descriptor.
 * @param states - A literal descriptor: `'boolean'` for presence states, or a nonempty array of values.
 * @returns The component, typed with its declared states.
 * @throws {Style.InvalidError} When the component is not an object or function, or a state name or domain is invalid.
 */
export function part<
  const component extends object,
  const states extends part.States,
>(component: component, states: states): part.ReturnType<component, states> {
  if (
    component === null ||
    (typeof component !== 'function' && typeof component !== 'object')
  )
    throw new Style.InvalidError([
      {
        code: 'invalid_structure',
        message: 'Parts require a component object or function.',
        path: [],
      },
    ])

  if (!states || typeof states !== 'object' || Array.isArray(states))
    throw new Style.InvalidError([
      {
        code: 'invalid_structure',
        message: 'Part states require a static object.',
        path: [],
      },
    ])

  const descriptor: Record<string, 'boolean' | readonly string[]> = {}

  for (const [name, domain] of Object.entries(states)) {
    const valid =
      /^[a-z][a-zA-Z\d]*$/.test(name) &&
      (domain === 'boolean' ||
        (Array.isArray(domain) &&
          domain.length > 0 &&
          domain.every(
            (value) => typeof value === 'string' && !value.includes('\0'),
          )))
    if (!valid)
      throw new Style.InvalidError([
        {
          code: 'invalid_structure',
          message: `Invalid part state: ${name}.`,
          path: [name],
        },
      ])

    descriptor[name] =
      domain === 'boolean' ? domain : Object.freeze([...domain])
  }

  Object.defineProperty(component, Authoring.states, {
    value: Object.freeze(descriptor),
  })

  return component as part.ReturnType<component, states>
}

/** Part declaration contracts. */
export declare namespace part {
  /** The component typed with the state domains its descriptor declares. */
  type ReturnType<component, states extends States> = component &
    Part<{
      readonly [name in keyof states]: states[name] extends readonly (infer value extends
        string)[]
        ? value
        : boolean
    }>
  /** Literal state descriptor by camelCase name. */
  type States = {
    readonly [name: string]: 'boolean' | readonly [string, ...string[]]
  }
}
