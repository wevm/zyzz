/**
 * Copies typed style declarations into immutable, ordered, target-independent data.
 * @module
 */
import * as Condition from './internal/Condition.js'
import * as Query from './internal/Query.js'
import * as Binding from './internal/Binding.js'
import type * as Literal from './internal/Literal.js'
import * as Token from './internal/Token.js'
import * as Value from './internal/Value.js'
import type * as Theme from './Theme.js'
/** Validates only authored keys, recursively retaining nested token inference. */
export type Accepted<
  style,
  tokens extends Theme.Tokens = {},
  literal extends boolean = false,
> = Record<
  Exclude<
    Keys<style>,
    keyof Literal.Properties | Condition.Keys<tokens, Keys<style>>
  >,
  never
> &
  (style extends unknown
    ? {
        [key in keyof style]: key extends keyof Literal.Properties
          ? Value.Accepted<
              Pick<style, key>,
              literal extends true
                ? LiteralDeclarations
                : DeclarationProperties<tokens>
            >[key] &
              Value.Checked<Pick<style, key>, tokens>[key]
          : key extends Condition.Keys<tokens, key>
            ? [style[key]] extends [undefined]
              ? never
              : NonNullable<style[key]> extends Record<string, unknown>
                ?
                    | Accepted<NonNullable<style[key]>, tokens, literal>
                    | Extract<style[key], undefined>
                : never
            : never
      }
    : never)
type Keys<value> = value extends unknown ? keyof value : never
type Exact<
  styles extends Record<string, unknown>,
  tokens extends Theme.Tokens,
> = {
  [name in keyof styles]: Extract<
    styles[name],
    (...args: never[]) => unknown
  > extends never
    ? Properties<tokens> extends styles[name]
      ? styles[name] extends Properties<tokens>
        ? styles[name] &
            Record<Exclude<Keys<styles[name]>, keyof Properties<tokens>>, never>
        : never
      : DeclarationProperties<tokens> extends styles[name]
        ? styles[name] extends DeclarationProperties<tokens>
          ? styles[name] &
              Record<
                Exclude<
                  Keys<styles[name]>,
                  keyof DeclarationProperties<tokens>
                >,
                never
              >
          : never
        : Accepted<styles[name], tokens>
    : never
}
const nesting = Symbol('zyzz.style.nesting')

/** A typed declaration; order is significant for future cascade processing. */
export type Declaration = {
  /** Whether this declaration overrides normal declarations in the cascade. */
  readonly important?: boolean | undefined
  /** Supported CSS property in camelCase. */
  readonly property: keyof Literal.Properties
  /** Validated primitive or immutable, domain-checked theme reference. */
  readonly value:
    | number
    | string
    | Token.Reference
    | Token.Expression
    | Binding.Reference
}

/**
 * Copies named literal and token styles into deeply frozen ordered data.
 * CSS values are checked by TypeScript only.
 * Preserves names, values, and JavaScript own-property enumeration order. Never
 * evaluates accessors, mutates input, generates CSS, or reads an environment.
 * Empty maps and empty styles are valid. See the literal subset documentation.
 * @param styles - Plain objects containing supported primitives or typed theme references.
 * @param options - Optional theme for shorthand names and caller-owned diagnostic source spans.
 * @returns Immutable definitions retaining the inferred style-name union.
 * @throws {InvalidError} If the input structure cannot represent ordered declarations.
 */
export function define<
  const styles extends Record<string, unknown>,
  const tokens extends Theme.Tokens,
>(
  styles: styles &
    NoInfer<Exact<styles, tokens>> & {
      [key in keyof styles]: WithoutRelationships<styles[key]>
    },
  options: define.Options<tokens>,
): Definition<`${Extract<keyof styles, number | string>}`>
export function define<const styles extends Record<string, unknown>>(
  styles: styles &
    NoInfer<Exact<styles, {}>> & {
      [key in keyof styles]: WithoutRelationships<styles[key]>
    },
  options?: define.Options,
): Definition<`${Extract<keyof styles, number | string>}`>
export function define(
  styles: Record<string, unknown>,
  options: define.Options = {},
): Definition {
  if ((options[nesting] ?? 0) > 128)
    throw new InvalidError([
      {
        code: 'invalid_structure',
        path: [],
        message: 'Nested styles exceed the depth limit.',
      },
    ])
  const diagnostics: Diagnostic[] = []
  const output: NamedStyle[] = []
  // One definition owns one theme; only validated references are reused within this call.
  const references = new Map<
    keyof Literal.Properties,
    Map<string | number, Token.Reference>
  >()
  function report(
    code: Diagnostic['code'],
    path: readonly string[],
    message: string,
  ) {
    const span = options.locations?.find(
      (location) =>
        location.path.length === path.length &&
        location.path.every((part, i) => part === path[i]),
    )
    const location = span
      ? Object.freeze({ ...span, path: Object.freeze([...span.path]) })
      : undefined
    diagnostics.push(
      Object.freeze({
        code,
        message,
        path: Object.freeze([...path]),
        ...(location ? { location } : {}),
      }),
    )
  }
  function entries(
    value: unknown,
    path: readonly string[],
  ): readonly (readonly [string, unknown])[] {
    const prototype: object | null | undefined =
      typeof value === 'object' && value !== null
        ? Object.getPrototypeOf(value)
        : undefined
    // Compare the native Object constructor across realms without reading getters.
    const constructor: unknown =
      prototype &&
      prototype !== Object.prototype &&
      Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value
    if (
      typeof value !== 'object' ||
      value === null ||
      (prototype !== null &&
        prototype !== Object.prototype &&
        (prototype === undefined ||
          Object.getPrototypeOf(prototype) !== null ||
          typeof constructor !== 'function' ||
          Function.prototype.toString.call(constructor) !==
            Function.prototype.toString.call(Object)))
    ) {
      report(
        'invalid_structure',
        path,
        'Expected a plain object with enumerable data properties.',
      )
      return []
    }
    const result: [string, unknown][] = []
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        typeof key !== 'string' ||
        !descriptor?.enumerable ||
        !('value' in descriptor)
      ) {
        report(
          'invalid_structure',
          typeof key === 'string' ? [...path, key] : path,
          'Only enumerable string-keyed data properties are supported; accessors and symbols are not evaluated.',
        )
        continue
      }
      result.push([key, descriptor.value])
    }
    return result
  }
  for (const [name, style] of entries(styles, [])) {
    if (name.length === 0)
      report('invalid_structure', [name], 'Style names must not be empty.')
    const mappings = options.theme?.[Token.definition].contract.shorthands
    const authored = entries(style, [name])
    const properties = authored.flatMap(([property, input]) =>
      (mappings?.[property] ?? [property]).map(
        (target) => [target, input, property] as const,
      ),
    )
    if (properties.some(([key]) => Condition.is(key))) {
      const rules: Rule[] = []
      for (const [key, input] of authored) {
        try {
          const condition = Condition.is(key)
            ? Query.resolve(
                key,
                options.theme?.[Token.definition].queries ?? {
                  breakpoints: {},
                  containers: {},
                  containerNames: [],
                },
              )
            : undefined
          if (condition !== undefined) Condition.normalize(condition)
          const nested = (
            define as (
              styles: Record<string, unknown>,
              options: define.Options,
            ) => Definition
          )(
            { [name]: condition === undefined ? { [key]: input } : input },
            {
              ...options,
              [nesting]: (options[nesting] ?? 0) + 1,
              locations: options.locations
                ?.filter(
                  (location) =>
                    condition === undefined || location.path[1] === key,
                )
                .map((location) =>
                  condition === undefined
                    ? location
                    : {
                        ...location,
                        path: location.path.filter((_, index) => index !== 1),
                      },
                ),
            },
          )
          rules.push(
            Object.freeze({
              ...(condition === undefined
                ? {}
                : {
                    condition: Condition.normalize(
                      condition.startsWith(':') && !Condition.nested(condition)
                        ? `&${condition}`
                        : condition,
                    ),
                  }),
              style: nested.styles[0]!,
            }),
          )
        } catch (error) {
          if (error instanceof InvalidError)
            diagnostics.push(
              ...error.diagnostics.map((diagnostic) =>
                Condition.is(key)
                  ? Object.freeze({
                      ...diagnostic,
                      path: Object.freeze([
                        name,
                        key,
                        ...diagnostic.path.slice(1),
                      ]),
                      ...(diagnostic.location
                        ? {
                            location: Object.freeze({
                              ...diagnostic.location,
                              path: Object.freeze([
                                name,
                                key,
                                ...diagnostic.location.path.slice(1),
                              ]),
                            }),
                          }
                        : {}),
                    })
                  : diagnostic,
              ),
            )
          else
            report('invalid_structure', [name, key], (error as Error).message)
        }
      }
      output.push(
        Object.freeze({
          name,
          declarations: Object.freeze([]),
          rules: Object.freeze(rules),
        }),
      )
      continue
    }
    const declarations: Declaration[] = []
    for (const [property, input, authoredProperty] of properties) {
      const key = property as keyof Literal.Properties
      const inputs: unknown[] = []
      if (Array.isArray(input)) {
        if (!input.length) {
          report(
            'invalid_value',
            [name, authoredProperty],
            'Fallback arrays must be nonempty.',
          )
          continue
        }
        for (let index = 0; index < input.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(
            input,
            String(index),
          )
          if (!descriptor || !('value' in descriptor)) {
            report(
              'invalid_structure',
              [name, authoredProperty, String(index)],
              'Fallback arrays require dense data entries without accessors.',
            )
            continue
          }
          inputs.push(descriptor.value)
        }
        if (inputs.length !== input.length) continue
      } else inputs.push(input)
      for (const entry of inputs) {
        if (
          typeof entry === 'object' &&
          entry !== null &&
          Object.getOwnPropertyDescriptor(entry, 'variable')?.value === true &&
          !Binding.is(entry)
        ) {
          report(
            'invalid_structure',
            [name, authoredProperty],
            'Invalid compiler binding reference.',
          )
          continue
        }
        const parsed = Value.parse(entry, key)
        const scalar = parsed ? parsed.value : entry
        const resolved = (() => {
          if (!options.theme) return scalar
          if (typeof scalar !== 'string' && typeof scalar !== 'number')
            return scalar
          const cached = references.get(key)?.get(scalar)
          if (cached) return cached
          const resolved = Token.resolve(scalar, {
            property: key,
            theme: options.theme,
          })
          if (Token.is(resolved)) {
            let values = references.get(key)
            if (!values) references.set(key, (values = new Map()))
            values.set(scalar, resolved)
          }
          return resolved
        })()
        const value = parsed && resolved === '0' ? 0 : resolved
        declarations.push(
          Object.freeze({
            ...(parsed?.important ? { important: true } : {}),
            property: key,
            value: value as
              | number
              | string
              | Token.Reference
              | Token.Expression
              | Binding.Reference,
          }),
        )
      }
    }
    output.push(
      Object.freeze({ declarations: Object.freeze(declarations), name }),
    )
  }
  if (diagnostics.length) throw new InvalidError(diagnostics)
  // Validated names are precisely the input's enumerable string keys.
  return Object.freeze({
    styles: Object.freeze(output),
  })
}

/** Options for defining styles. */
export declare namespace define {
  /** Source locations are optional; pure in-memory callers need no source text. */
  type Options<tokens extends Theme.Tokens = never> = {
    /** Internal recursion budget, propagated only by structured authoring. */
    readonly [nesting]?: number | undefined
    /** Caller-provided spans matched by complete diagnostic path. */
    readonly locations?: readonly SourceLocation[] | undefined
  } & ([tokens] extends [never]
    ? {
        /** Optional themes do not enable shorthand inference. */
        readonly theme?: Theme.Definition | undefined
      }
    : {
        /** Shorthand inference requires a defined token contract. */
        readonly theme: Theme.Definition<tokens>
      })
}

/** Immutable data passed from authoring to later target compilation. */
export type Definition<name extends string = string> = {
  /** Named styles in own enumerable property order. */
  readonly styles: readonly NamedStyle<name>[]
}

/** A caller-visible validation failure at an exact input path. */
export type Diagnostic = {
  /** Stable machine-readable category. */
  readonly code: 'invalid_structure' | 'invalid_value'
  /** Source span when a caller supplied an exact matching path. */
  readonly location?: SourceLocation | undefined
  /** Explanation of the supported input contract. */
  readonly message: string
  /** Path components, without ambiguous dot concatenation. */
  readonly path: readonly string[]
}

/** Validation error containing all failures in deterministic input order. */
export class InvalidError extends Error {
  /** Creates an error from caller-visible validation diagnostics. */
  constructor(diagnostics: readonly Diagnostic[]) {
    super(
      diagnostics
        .map((item) => `${JSON.stringify(item.path)}: ${item.message}`)
        .join('\n'),
    )
    this.diagnostics = Object.freeze([...diagnostics])
  }
  /** Frozen diagnostics, ordered by style and declaration traversal. */
  readonly diagnostics: readonly Diagnostic[]
  /** Stable namespaced error identifier. */
  override name = 'Style.InvalidError'
}

type LiteralAtoms = {
  readonly [property in keyof Literal.Properties]-?: Value.Atom<
    | Exclude<Literal.Properties[property], undefined>
    | {
        [kind in Binding.Kind]: property extends Binding.Properties<kind>
          ? Binding.Reference<kind>
          : never
      }[Binding.Kind]
  >
}

/** Supported primitive CSS declarations without theme references. */
export type LiteralDeclarations = {
  readonly [property in keyof Literal.Properties]: Value.Fallbacks<
    LiteralAtoms[property]
  >
}

/** A named group of ordered declarations. */
export type NamedStyle<name extends string = string> = {
  /** Ordered nested blocks, when this style contains conditions. */
  readonly rules?: readonly Rule[] | undefined
  /** Declarations in own enumerable property order. */
  readonly declarations: readonly Declaration[]
  /** Authored style name, without generated target identifiers. */
  readonly name: name
}

/** Supported literal and token declarations. Unknown properties and undefined values are rejected. */
export type DeclarationProperties<tokens extends Theme.Tokens = {}> = {
  readonly [property in keyof Literal.Properties]: Value.Fallbacks<
    | LiteralAtoms[property]
    | Value.Atom<Token.Names<tokens, property>>
    | {
        [group in Token.Group]: property extends Token.Properties<group>
          ? Token.Reference<group>
          : never
      }[Token.Group]
  >
}

/** Recursive theme-aware declaration and condition authoring. */
export type Properties<tokens extends Theme.Tokens = {}> =
  DeclarationProperties<tokens> & {
    readonly [key in Condition.Keys<tokens>]?: Properties<tokens>
  }

/** Nested literal declarations retain exact keys at every depth. */
export type LiteralProperties = LiteralDeclarations & {
  readonly [key in Condition.Keys]?: LiteralProperties
}

/** Ordered nested blocks; an absent condition represents a declaration segment. */
export type Rule = {
  /** Scoped selector or conditional at-rule; absent for a declaration segment. */
  readonly condition?: string | undefined
  /** Immutable nested declarations and ordered child rules. */
  readonly style: NamedStyle
}

/** A source span optionally attached to a diagnostic by a caller. */
export type SourceLocation = {
  /** Exclusive source offset. */
  readonly end: number
  /** Path from the style map root to the associated input. */
  readonly path: readonly string[]
  /** Caller-owned source identifier, independent of filesystem paths. */
  readonly source: string
  /** Inclusive source offset. */
  readonly start: number
}

/** Core definitions exclude compiler-owned web relationship keys. */
type WithoutRelationships<value> = value extends readonly unknown[]
  ? unknown
  : value extends object
    ? {
        [key in keyof value]: key extends symbol
          ? never
          : key extends keyof Literal.Properties
            ? unknown
            : WithoutRelationships<value[key]>
      }
    : unknown
