/**
 * Rebuilds frozen module output from the engine's encoding, independently of the engine that
 * produced it, so hosts without the native addon decode the same shape.
 * @module
 */
import type * as Mapping from '@jridgewell/gen-mapping'
import * as ClassName from '../../web/internal/ClassName.js'
import * as ThemeRules from '../../web/internal/Themes.js'
import type * as Transform from '../Transform.js'

/** One module's transform output as the engine encodes it. */
export type Encoded = Records & {
  readonly code: string
  readonly css: string
  readonly cssMap: Mapping.EncodedSourceMap
  readonly map: Transform.compile.ReturnType['map']
  readonly shared?: readonly ThemeRules.Resource[] | undefined
  readonly vars: Readonly<Record<string, string>>
}

/** A module's class, rule, and unit records as the engine encodes them. */
export type Records = {
  readonly classes: Readonly<Record<string, string>>
  readonly rules: Readonly<Record<string, string>>
  readonly units: readonly (readonly [string, boolean, string])[]
}

/**
 * Rebuilds one module's frozen transform output. Records decode when first read, so a module
 * whose classes, rules, and units are never read skips their parsing.
 * @param value - The encoded module, with its records unless `records` holds them.
 * @param source - Module text the engine left out of the maps' `sourcesContent`.
 * @param records - The encoded records, which `transform.compile` writes apart.
 * @returns The output `Transform.compile` returns.
 */
export function decode(
  value: Omit<Encoded, keyof Records> & Partial<Records>,
  source?: string | undefined,
  records?: string | undefined,
): Transform.compile.ReturnType {
  // The engine writes `0` for content the caller supplied separately, so it crosses once.
  if (source !== undefined)
    for (const map of [value.cssMap, value.map]) {
      const contents = map.sourcesContent as (string | null | 0)[] | undefined

      for (let index = 0; index < (contents?.length ?? 0); index++)
        if (contents![index] === 0) contents![index] = source
    }

  let decoded: Records | undefined =
    records === undefined ? (value as Records) : undefined
  let classes: Transform.compile.ReturnType['classes'] | undefined
  let rules: Transform.compile.ReturnType[typeof ClassName.rules] | undefined
  let units: Transform.compile.ReturnType[typeof ClassName.units] | undefined
  const read = () => (decoded ??= JSON.parse(records!) as Records)

  const result = {
    ...(value.shared
      ? {
          [ThemeRules.shared]: Object.freeze(
            value.shared.map((resource) => Object.freeze(resource)),
          ),
        }
      : {}),
    // Parsed records are fresh, so they freeze in place rather than as copies.
    get classes() {
      return (classes ??= Object.freeze(read().classes))
    },
    code: value.code,
    css: value.css,
    cssMap: value.cssMap,
    map: value.map,
    vars: Object.freeze(Object.setPrototypeOf(value.vars, null)),
  }

  Object.defineProperties(result, {
    [ClassName.rules]: {
      enumerable: false,
      get: () => (rules ??= Object.freeze(read().rules)),
    },
    [ClassName.units]: {
      enumerable: false,
      get: () =>
        (units ??= new Map(
          read().units.map(([key, borrowed, name]) => [
            key,
            { borrowed, name },
          ]),
        )),
    },
  })

  return Object.freeze(result) as Transform.compile.ReturnType
}
