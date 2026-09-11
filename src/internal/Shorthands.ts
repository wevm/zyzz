/** Validates ordered configuration property aliases without interpreting CSS values. @module */
import * as Literal from './Literal.js'

/** Standard properties accepted as alias targets. */
export type Property = Exclude<keyof Literal.Properties, `--${string}`>
/** Explicit aliases, each expanding in its declared target order. */
export type Map = Readonly<Record<string, readonly [Property, ...Property[]]>>
/** Rejects duplicate targets and names reserved by the authoring surface. */
export type Validated<mappings extends Map> = {
  [key in keyof mappings]: key extends
    | keyof Literal.Properties
    | `:${string}`
    | `@${string}`
    | `${string}&${string}`
    | 'css'
    | 'theme'
    | 'themes'
    | 'script'
    | 'variants'
    | '__proto__'
    ? never
    : Unique<mappings[key]>
}
type Unique<
  targets extends readonly Property[],
  seen extends Property = never,
> = targets extends readonly [
  infer target extends Property,
  ...infer rest extends readonly Property[],
]
  ? target extends seen
    ? never
    : Unique<rest, seen | target>
  : unknown

/** Copies validated configuration data; throws for invalid aliases or targets. */
export function read(value: unknown): Map {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('shorthands must be a property mapping record.')
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value))
  return Object.freeze(
    Object.setPrototypeOf(
      Object.fromEntries(
        entries.map(([name, descriptor]) => {
          if (
            !/^[a-zA-Z_][\w]*$/.test(name) ||
            Object.hasOwn(Literal.rules, name) ||
            [
              'css',
              'theme',
              'themes',
              'script',
              'variants',
              '__proto__',
            ].includes(name)
          )
            throw new Error(`Invalid shorthand name: ${name}`)
          const targets: unknown = descriptor.value
          if (
            !('value' in descriptor) ||
            !Array.isArray(targets) ||
            !targets.length
          )
            throw new Error(
              `Shorthand ${name} requires a nonempty property tuple.`,
            )
          const result: Property[] = []
          for (let index = 0; index < targets.length; index++) {
            const target: unknown = Object.getOwnPropertyDescriptor(
              targets,
              String(index),
            )?.value
            if (
              typeof target !== 'string' ||
              !Object.hasOwn(Literal.rules, target) ||
              result.includes(target as Property)
            )
              throw new Error(
                `Shorthand ${name} requires unique standard properties.`,
              )
            result.push(target as Property)
          }
          return [name, Object.freeze(result)]
        }),
      ),
      null,
    ),
  ) as Map
}
