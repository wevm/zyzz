/**
 * Copies typed style declarations into immutable, ordered, target-independent data.
 * @module
 */
import type * as Binding from './internal/Binding.js'
import type * as Literal from './internal/Literal.js'
import * as Token from './internal/Token.js'
import * as Value from './internal/Value.js'
import type * as Theme from './Theme.js'
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
        ? styles[name]
        : never
      : Value.Accepted<styles[name], Properties<tokens>> &
          Value.Checked<styles[name], tokens> &
          Record<Exclude<Keys<styles[name]>, keyof Properties>, never>
    : never
}
type Keys<value> = value extends unknown ? keyof value : never

/** A typed declaration; order is significant for future cascade processing. */
export type Declaration = {
  /** Whether this declaration overrides normal declarations in the cascade. */
  readonly important?: boolean | undefined
  /** Supported CSS property in camelCase. */
  readonly property: keyof Properties
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
  styles: styles & NoInfer<Exact<styles, tokens>>,
  options: define.Options<tokens>,
): Definition<`${Extract<keyof styles, number | string>}`>
export function define<const styles extends Record<string, unknown>>(
  styles: styles & NoInfer<Exact<styles, {}>>,
  options?: define.Options,
): Definition<`${Extract<keyof styles, number | string>}`>
export function define(
  styles: Record<string, unknown>,
  options: define.Options = {},
): Definition {
  const diagnostics: Diagnostic[] = []
  const output: NamedStyle[] = []
  // One definition owns one theme; only validated references are reused within this call.
  const references = new Map<
    keyof Properties,
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
    const declarations: Declaration[] = []
    for (const [property, input] of entries(style, [name])) {
      const key = property as keyof Properties
      const inputs: unknown[] = []
      if (Array.isArray(input)) {
        if (!input.length) {
          report(
            'invalid_value',
            [name, property],
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
              [name, property, String(index)],
              'Fallback arrays require dense data entries without accessors.',
            )
            continue
          }
          inputs.push(descriptor.value)
        }
        if (inputs.length !== input.length) continue
      } else inputs.push(input)
      for (const entry of inputs) {
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
export type LiteralProperties = {
  readonly [property in keyof Literal.Properties]: Value.Fallbacks<
    | LiteralAtoms[property]
    | {
        [group in Token.Group]: property extends Token.Properties<group>
          ? Token.Variable<group>
          : never
      }[Token.Group]
  >
}

/** A named group of ordered declarations. */
export type NamedStyle<name extends string = string> = {
  /** Declarations in own enumerable property order. */
  readonly declarations: readonly Declaration[]
  /** Authored style name, without generated target identifiers. */
  readonly name: name
}

/** Supported literal and token declarations. Unknown properties and undefined values are rejected. */
export type Properties<tokens extends Theme.Tokens = {}> = {
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
