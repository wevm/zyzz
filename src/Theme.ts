/**
 * Defines typed token contracts and compatible immutable theme overrides.
 * @module
 */
import { css, MissingTransformError } from './css.js'
import type * as Binding from './internal/Binding.js'
import type * as Literal from './internal/Literal.js'
import * as Query from './internal/Query.js'
import * as Token from './internal/Token.js'
import type * as Value from './internal/Value.js'
import type * as Style from './Style.js'

/** Complete color-scheme pair or a shared color. */
export type Color =
  | Literal.Color
  | { readonly dark: Literal.Color; readonly light: Literal.Color }

/** Theme-bound authoring signature; execution requires source rewriting. */
export type Css<tokens extends Tokens> = {
  <
    const values extends Record<string, string | number>,
    const styles extends Record<string, unknown>,
  >(
    styles: ((
      values: values,
    ) => styles &
      NoInfer<Style.Accepted<styles, tokens> & Binding.Checked<styles>>) &
      (values extends Binding.Inputs<values> ? unknown : never),
  ): css.Dynamic<values>
  <const styles extends Record<string, unknown>>(
    styles: styles & NoInfer<Style.Accepted<styles, tokens>>,
  ): css.ReturnType
  <const styles extends Style.Properties<tokens>>(
    styles: styles &
      NoInfer<
        (Style.Properties<tokens> extends styles
          ? unknown
          : Style.Accepted<styles, tokens>) &
          (Extract<styles, (...args: never[]) => unknown> extends never
            ? unknown
            : never)
      >,
  ): css.ReturnType
}

/**
 * Defines scalar tokens without metadata, defaults, or environment access.
 * Colors currently use the supported literal color grammar; spacing and radius
 * values use nonnegative literal lengths or zero. Nested palettes are supported.
 * @throws {InvalidError} If groups, paths, values, or data records are invalid.
 */
export function define<const tokens extends Tokens>(
  tokens: tokens & NoInfer<Validated<tokens>>,
): Definition<tokens> {
  return build(tokens, Object.freeze({})) as unknown as Definition<tokens>
}

/** A theme contract with immutable, property-aware portable token references. */
export type Definition<
  tokens extends Tokens = Tokens,
  boundCss extends (...args: never[]) => unknown = Css<tokens>,
> = {
  /** Compiled scope class; reading untransformed authoring throws. */
  readonly className: string
  /** Token-aware callable authoring boundary, replaced by the source compiler. */
  readonly css: boundCss
  /** Internal contract and resolved values, carried without a registry. */
  readonly [Token.definition]: Token.Metadata
  /** Inferred references for use in Style.define declarations. */
  readonly tokens: References<tokens>
  /** Web variable references; source templates retain their identity and fallback. */
  readonly vars: Token.Variables<References<tokens>>
}

/**
 * Overrides existing leaves while retaining the base theme's token identities.
 * Omitted leaves inherit resolved values. Color overrides replace complete pairs.
 * @throws {InvalidError} If the base is invalid or overrides alter its contract.
 */
export function extend<
  const tokens extends Tokens,
  const overrides extends Record<string, unknown>,
  const boundCss extends (...args: never[]) => unknown = Css<tokens>,
>(
  theme: Definition<tokens, boundCss>,
  overrides: overrides &
    NoInfer<Exact<overrides, Overrides<tokens>>> &
    NoInfer<Validated<overrides>>,
): Definition<tokens, boundCss> {
  if (!theme || typeof theme !== 'object')
    throw new InvalidError([], 'Expected a theme definition.')

  const data = Object.getOwnPropertyDescriptor(theme, Token.definition)
    ?.value as Token.Metadata | undefined
  if (!data) throw new InvalidError([], 'Expected a theme definition.')

  return build(
    overrides,
    data.contract,
    data.values,
    data.queries,
  ) as unknown as Definition<tokens, boundCss>
}

type Exact<input, shape> = {
  [key in keyof input]: key extends keyof shape
    ? NonNullable<shape[key]> extends string | number
      ? Required<shape>[key]
      : input[key] extends readonly unknown[] | ((...args: never[]) => unknown)
        ? never
        : input[key] extends object
          ? shape[key] extends Color | undefined
            ? Color
            : Exact<input[key], NonNullable<shape[key]>>
          : Required<shape>[key]
    : never
}

/** Invalid token data with an unambiguous authored path. */
export class InvalidError extends Error {
  /** Creates an immutable diagnostic path without reading token values. */
  constructor(path: readonly string[], message: string) {
    super(`${JSON.stringify(path)}: ${message}`)
    this.path = Object.freeze([...path])
  }
  /** Stable namespaced error identifier. */
  override name = 'Theme.InvalidError'
  /** Group and nested keys identifying the failure. */
  readonly path: readonly string[]
}

/** Existing paths with widened values and optional branches. */
export type Overrides<tokens> = {
  readonly [group in keyof tokens]?: OverrideTree<tokens[group], group>
}

type OverrideTree<tree, group> = tree extends string | number
  ? Scalar<group>
  : tree extends { readonly dark: string; readonly light: string }
    ? Color
    : { readonly [key in keyof tree]?: OverrideTree<tree[key], group> }

/** Nested palette or scale data. */
export type Palette<leaf> = { readonly [key: string]: leaf | Palette<leaf> }

/** Portable reference restricted to its token group. */
export type Reference<group extends Token.Group = Token.Group> =
  Token.Reference<group>

/** The inferred tree replaces scalar values and scheme pairs with references. */
export type References<tokens> = {
  readonly [group in keyof tokens as group extends Token.Group
    ? group
    : never]: ReferenceTree<tokens[group], Extract<group, Token.Group>>
}

type ReferenceTree<tree, group extends Token.Group> = tree extends
  | string
  | number
  | { readonly dark: string; readonly light: string }
  ? Reference<group>
  : { readonly [key in keyof tree]: ReferenceTree<tree[key], group> }

/** Supported scalar groups; composite presets and query metadata follow separately. */
type Scalar<group> = group extends
  | 'spacing'
  | 'borderRadius'
  | 'margin'
  | 'padding'
  ? Literal.Length
  : group extends
        | 'fontFamily'
        | 'fontSize'
        | 'fontWeight'
        | 'letterSpacing'
        | 'lineHeight'
    ? Exclude<
        NonNullable<Literal.Properties[group]>,
        'initial' | 'inherit' | 'unset' | 'revert' | 'revert-layer'
      >
    : group extends 'breakpoints' | 'containers'
      ? Query.Length
      : Color

export type Tokens = {
  /** Colors available to background declarations. */
  readonly backgroundColor?: Palette<Color> | undefined
  /** Colors available to border declarations. */
  readonly borderColor?: Palette<Color> | undefined
  /** Nonnegative corner radii. */
  readonly borderRadius?: Palette<Literal.Length> | undefined
  /** Compile-time viewport width thresholds. */
  readonly breakpoints?: Readonly<Record<string, Query.Length>> | undefined
  /** Shared colors available to every supported color property. */
  readonly color?: Palette<Color> | undefined
  /** Finite CSS container identities for named queries. */
  readonly containerNames?: readonly string[] | undefined
  /** Compile-time container width thresholds. */
  readonly containers?: Readonly<Record<string, Query.Length>> | undefined
  /** Font family token values; does not load font files. */
  readonly fontFamily?:
    | Palette<NonNullable<Literal.Properties['fontFamily']>>
    | undefined
  /** Font size token values. */
  readonly fontSize?:
    | Palette<NonNullable<Literal.Properties['fontSize']>>
    | undefined
  /** Font weight token values. */
  readonly fontWeight?:
    | Palette<NonNullable<Literal.Properties['fontWeight']>>
    | undefined
  /** Letter spacing token values. */
  readonly letterSpacing?:
    | Palette<NonNullable<Literal.Properties['letterSpacing']>>
    | undefined
  /** Line height token values. */
  readonly lineHeight?:
    | Palette<NonNullable<Literal.Properties['lineHeight']>>
    | undefined
  /** Signed spacing for margins, preferred over shared spacing tokens. */
  readonly margin?: Palette<Literal.Length> | undefined
  /** Nonnegative padding, preferred over shared spacing tokens. */
  readonly padding?: Palette<Literal.Length> | undefined
  /** Nonnegative spacing and sizing values. */
  readonly spacing?: Palette<Literal.Length> | undefined
  /** Colors available to text declarations. */
  readonly textColor?: Palette<Color> | undefined
}

function build(
  input: unknown,
  contract: Token.Contract,
  base?: Readonly<Record<string, Token.Value>>,
  baseQueries?: Query.Metadata,
) {
  const values: Record<string, Token.Value> = Object.assign(
    Object.create(null),
    base,
  )

  const queries = {
    breakpoints: Object.assign(
      Object.create(null),
      baseQueries?.breakpoints,
    ) as Record<string, string>,
    containerNames: baseQueries?.containerNames ?? [],
    containers: Object.assign(
      Object.create(null),
      baseQueries?.containers,
    ) as Record<string, string>,
  }

  let hasQueries = !!baseQueries
  const active = new Set<object>()

  function visit(value: unknown, group: Token.Group, path: readonly string[]) {
    const key = path.join('.')
    const scalar = typeof value === 'string' || typeof value === 'number'
    const entries = scalar ? undefined : record(value, path)
    const pair =
      ['color', 'backgroundColor', 'borderColor', 'textColor'].includes(
        group,
      ) && entries?.some(([name]) => name === 'light' || name === 'dark')

    if (scalar || pair) {
      if (base && !Object.hasOwn(base, key))
        throw new InvalidError(
          path,
          'Extensions cannot add or replace token paths.',
        )

      if (pair) {
        if (
          !['color', 'backgroundColor', 'borderColor', 'textColor'].includes(
            group,
          ) ||
          entries!.length !== 2 ||
          !entries!.some(([name]) => name === 'light') ||
          !entries!.some(([name]) => name === 'dark')
        )
          throw new InvalidError(
            path,
            'Expected a complete light/dark color pair.',
          )

        const schemes = Object.fromEntries(entries!)

        values[key] = Object.freeze({
          dark: schemes.dark as string,
          light: schemes.light as string,
        })
      } else {
        values[key] = value as number | string
      }

      return
    }

    if (!entries!.length && !base)
      throw new InvalidError(path, 'Token palettes cannot be empty.')

    if (base && Object.hasOwn(base, key))
      throw new InvalidError(path, 'A token leaf cannot become a palette.')

    if (active.has(value as object))
      throw new InvalidError(path, 'Cyclic palettes are not supported.')

    active.add(value as object)

    for (const [name, child] of entries!) {
      const next = [...path, name]
      if (
        base &&
        !Object.keys(base).some(
          (key) =>
            key === next.join('.') || key.startsWith(`${next.join('.')}.`),
        )
      )
        throw new InvalidError(next, 'Extensions cannot add token paths.')

      visit(child, group, next)
    }

    active.delete(value as object)
  }

  for (const [group, palette] of record(input, [])) {
    if (palette === undefined) continue

    if (group === 'containerNames') {
      hasQueries = true

      if (
        !Array.isArray(palette) ||
        Array.from({ length: palette.length }, (_, index) =>
          Object.getOwnPropertyDescriptor(palette, index),
        ).some((field) => !field || !('value' in field)) ||
        palette.some(
          (name) =>
            typeof name !== 'string' ||
            !/^(?:--|-?(?:[_a-zA-Z\u0080-\uffff]|\\(?:[0-9a-fA-F]{1,6}[ \t\n\r\f]?|[^\n\r\f0-9a-fA-F])))(?:[-_a-zA-Z0-9\u0080-\uffff]|\\(?:[0-9a-fA-F]{1,6}[ \t\n\r\f]?|[^\n\r\f0-9a-fA-F]))*$/.test(
              name,
            ) ||
            [
              'none',
              'and',
              'not',
              'or',
              'default',
              'inherit',
              'initial',
              'unset',
              'revert',
              'revert-layer',
            ].includes(name.toLowerCase()),
        ) ||
        new Set(palette).size !== palette.length
      )
        throw new InvalidError(
          [group],
          'Expected unique container identifiers.',
        )

      if (
        base &&
        JSON.stringify(palette) !== JSON.stringify(baseQueries?.containerNames)
      )
        throw new InvalidError(
          [group],
          'Extensions cannot change container identities.',
        )

      queries.containerNames = Object.freeze([...palette])
      continue
    }

    if (group === 'breakpoints' || group === 'containers') {
      hasQueries = true

      for (const [name, value] of record(palette, [group])) {
        if (
          !/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(name) ||
          (group === 'breakpoints' &&
            ['all', 'screen', 'print'].includes(name)) ||
          !Query.threshold(value)
        )
          throw new InvalidError(
            [group, name],
            'Expected a named nonnegative length threshold.',
          )

        if (base && !Object.hasOwn(queries[group], name))
          throw new InvalidError(
            [group, name],
            'Extensions cannot add query thresholds.',
          )

        queries[group][name] = value
      }

      continue
    }

    if (
      ![
        'backgroundColor',
        'borderColor',
        'borderRadius',
        'color',
        'margin',
        'padding',
        'spacing',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'letterSpacing',
        'lineHeight',
        'textColor',
      ].includes(group)
    )
      throw new InvalidError([group], 'Unsupported token group.')

    if (palette === undefined) continue

    if (base && !Object.keys(base).some((key) => key.startsWith(`${group}.`)))
      throw new InvalidError([group], 'Extensions cannot add token groups.')

    // Groups are always records; scalar leaves begin below them.
    const entries = record(palette, [group])
    if (!entries.length && !base)
      throw new InvalidError([group], 'Token palettes cannot be empty.')

    for (const [name, value] of entries)
      visit(value, group as Token.Group, [group, name])
  }

  type Tree = { [key: string]: Tree | Token.Reference }

  const tokens: Tree = Object.create(null)

  for (const [path, value] of Object.entries(values)) {
    const parts = path.split('.')
    let tree = tokens

    for (const part of parts.slice(0, -1))
      tree = (tree[part] ??= Object.create(null)) as Tree

    tree[parts.at(-1)!] = Token.create({
      contract,
      group: parts[0] as Token.Group,
      path,
      value,
    })
  }

  function freeze(tree: Tree) {
    for (const value of Object.values(tree)) if (!Token.is(value)) freeze(value)

    Object.freeze(tree)
  }

  freeze(tokens)

  return Object.freeze(
    Object.defineProperty(
      {
        get className(): string {
          throw new MissingTransformError()
        },
        css,
        tokens,
        vars: Token.variables(tokens),
      },
      Token.definition,
      {
        value: Object.freeze({
          contract,
          values: Object.freeze(values),
          ...(hasQueries
            ? {
                queries: Object.freeze({
                  breakpoints: Object.freeze(queries.breakpoints),
                  containerNames: queries.containerNames,
                  containers: Object.freeze(queries.containers),
                }),
              }
            : {}),
        }),
      },
    ),
  )
}

function record(
  value: unknown,
  path: readonly string[],
): readonly (readonly [string, unknown])[] {
  if (!value || typeof value !== 'object')
    throw new InvalidError(path, 'Expected a plain data record.')

  const prototype: object | null = Object.getPrototypeOf(value)
  const constructor: unknown =
    prototype &&
    Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value
  if (
    prototype !== null &&
    (Object.getPrototypeOf(prototype) !== null ||
      typeof constructor !== 'function' ||
      Function.prototype.toString.call(constructor) !==
        Function.prototype.toString.call(Object))
  )
    throw new InvalidError(path, 'Expected a plain data record.')

  const entries: [string, unknown][] = []

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (typeof key === 'string' && key.includes('!'))
      throw new InvalidError(
        [...path, key],
        'Token keys cannot contain !; it is reserved for declaration importance.',
      )

    if (
      typeof key !== 'string' ||
      !key ||
      key.includes('.') ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    )
      throw new InvalidError(
        path,
        'Expected nonempty keys without dots and enumerable data properties.',
      )

    entries.push([key, descriptor.value])
  }

  return entries
}

type Validated<tokens> = Tokens extends tokens
  ? tokens
  : Overrides<Tokens> extends tokens
    ? tokens
    : {
        [group in keyof tokens]: group extends keyof Tokens
          ? group extends 'containerNames'
            ? ContainerNames<tokens[group]>
            : ValidPalette<tokens[group], group>
          : never
      }

type ContainerNames<names> = names extends readonly string[]
  ? UniqueNames<names> & {
      [index in keyof names]: ContainerName<names[index]>
    }
  : names

type UniqueNames<
  names extends readonly string[],
  seen extends string = never,
> = names extends readonly [
  infer name extends string,
  ...infer rest extends readonly string[],
]
  ? name extends seen
    ? never
    : UniqueNames<rest, seen | name>
  : unknown

type ContainerName<name> = name extends string
  ? Lowercase<name> extends
      | 'none'
      | 'and'
      | 'not'
      | 'or'
      | 'default'
      | 'inherit'
      | 'initial'
      | 'unset'
      | 'revert'
      | 'revert-layer'
    ? never
    : name
  : name

type ValidPalette<palette, group> = palette extends undefined
  ? undefined
  : {
      [key in keyof palette]: key extends `${string}!${string}`
        ? never
        : ValidTree<palette[key], group>
    }

type WeightDigits<
  text extends string,
  digits extends unknown[] = [],
> = text extends ''
  ? digits extends []
    ? false
    : true
  : digits['length'] extends 3
    ? false
    : text extends `${infer first}${infer rest}`
      ? first extends '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
        ? WeightDigits<rest, [...digits, unknown]>
        : false
      : false

type Weight<value> = value extends number
  ? number extends value
    ? value
    : `${value}` extends '1000'
      ? value
      : `${value}` extends `${infer whole}.${string}`
        ? whole extends '0'
          ? never
          : WeightDigits<whole> extends true
            ? value
            : never
        : `${value}` extends '0'
          ? never
          : WeightDigits<`${value}`> extends true
            ? value
            : never
  : value

type ValidTree<tree, group> = tree extends string | number
  ? tree extends Scalar<group>
    ? group extends 'breakpoints' | 'containers'
      ? tree extends `-${string}`
        ? never
        : Literal.Checked<tree>
      : group extends keyof Literal.Properties
        ? Literal.Checked<tree> &
            Value.Checked<Record<group, tree>>[group] &
            (group extends 'fontWeight' ? Weight<tree> : unknown) &
            (tree extends string
              ? Lowercase<tree> extends
                  | 'inherit'
                  | 'initial'
                  | 'unset'
                  | 'revert'
                  | 'revert-layer'
                ? never
                : unknown
              : unknown)
        : Literal.Checked<tree>
    : never
  : Extract<
        keyof tree,
        group extends 'color' | 'backgroundColor' | 'borderColor' | 'textColor'
          ? 'dark' | 'light'
          : never
      > extends never
    ? {
        [key in keyof tree]: key extends `${string}!${string}`
          ? never
          : ValidTree<tree[key], group>
      }
    : group extends 'color' | 'backgroundColor' | 'borderColor' | 'textColor'
      ? {
          readonly dark: Literal.Color &
            Literal.Checked<tree extends { dark: infer value } ? value : never>
          readonly light: Literal.Color &
            Literal.Checked<tree extends { light: infer value } ? value : never>
        } & Record<Exclude<keyof tree, 'dark' | 'light'>, never>
      : never
