/**
 * Defines typed token contracts and compatible immutable theme overrides.
 * @module
 */
import { css, MissingTransformError } from './css.js'
import type * as Literal from './internal/Literal.js'
import * as Token from './internal/Token.js'
import type * as Value from './internal/Value.js'
import type * as Style from './Style.js'

/** Complete color-scheme pair or a shared color. */
export type Color =
  | Literal.Color
  | { readonly dark: Literal.Color; readonly light: Literal.Color }

/** Theme-bound authoring signature; execution requires source rewriting. */
export type Css<tokens extends Tokens> = {
  <const styles extends Record<string, unknown>>(
    styles: styles &
      NoInfer<
        Value.Accepted<styles, Style.Properties<tokens>> &
          Record<Exclude<Keys<styles>, keyof Style.Properties>, never> &
          Value.Checked<styles, tokens>
      >,
  ): css.ReturnType
  <const styles extends Style.Properties<tokens>>(
    styles: styles &
      NoInfer<
        Record<Exclude<Keys<styles>, keyof Style.Properties>, never> &
          (Style.Properties<tokens> extends styles
            ? unknown
            : (Extract<styles, (...args: never[]) => unknown> extends never
                ? unknown
                : never) &
                Value.Checked<styles, tokens>)
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
export type Definition<tokens extends Tokens = Tokens> = {
  /** Compiled scope class; reading untransformed authoring throws. */
  readonly className: string
  /** Token-aware callable authoring boundary, replaced by the source compiler. */
  readonly css: Css<tokens>
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
>(
  theme: Definition<tokens>,
  overrides: overrides &
    NoInfer<Exact<overrides, Overrides<tokens>>> &
    NoInfer<Validated<overrides>>,
): Definition<tokens> {
  if (!theme || typeof theme !== 'object')
    throw new InvalidError([], 'Expected a theme definition.')
  const data = Object.getOwnPropertyDescriptor(theme, Token.definition)
    ?.value as Token.Metadata | undefined
  if (!data) throw new InvalidError([], 'Expected a theme definition.')
  return build(
    overrides,
    data.contract,
    data.values,
  ) as unknown as Definition<tokens>
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

type Keys<value> = value extends unknown ? keyof value : never

/** Existing paths with widened values and optional branches. */
export type Overrides<tokens> = {
  readonly [group in keyof tokens]?: OverrideTree<tokens[group], group>
}
type OverrideTree<tree, group> = tree extends string | number
  ? group extends 'spacing' | 'borderRadius'
    ? Literal.Length
    : Color
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
  readonly [group in keyof tokens]: ReferenceTree<
    tokens[group],
    Extract<group, Token.Group>
  >
}
type ReferenceTree<tree, group extends Token.Group> = tree extends
  | string
  | number
  | { readonly dark: string; readonly light: string }
  ? Reference<group>
  : { readonly [key in keyof tree]: ReferenceTree<tree[key], group> }

/** Supported scalar groups; composite presets and query metadata follow separately. */
export type Tokens = {
  /** Colors available to background declarations. */
  readonly backgroundColor?: Palette<Color> | undefined
  /** Colors available to border declarations. */
  readonly borderColor?: Palette<Color> | undefined
  /** Nonnegative corner radii. */
  readonly borderRadius?: Palette<Literal.Length> | undefined
  /** Shared colors available to every supported color property. */
  readonly color?: Palette<Color> | undefined
  /** Nonnegative spacing and sizing values. */
  readonly spacing?: Palette<Literal.Length> | undefined
  /** Colors available to text declarations. */
  readonly textColor?: Palette<Color> | undefined
}

function build(
  input: unknown,
  contract: Token.Contract,
  base?: Readonly<Record<string, Token.Value>>,
) {
  const values: Record<string, Token.Value> = Object.assign(
    Object.create(null),
    base,
  )
  const active = new Set<object>()

  function visit(value: unknown, group: Token.Group, path: readonly string[]) {
    const key = path.join('.')
    const scalar = typeof value === 'string' || typeof value === 'number'
    const entries = scalar ? undefined : record(value, path)
    const pair = entries?.some(([name]) => name === 'light' || name === 'dark')
    if (scalar || pair) {
      if (base && !Object.hasOwn(base, key))
        throw new InvalidError(
          path,
          'Extensions cannot add or replace token paths.',
        )
      if (pair) {
        if (
          group === 'spacing' ||
          group === 'borderRadius' ||
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
    if (
      ![
        'backgroundColor',
        'borderColor',
        'borderRadius',
        'color',
        'spacing',
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
        value: Object.freeze({ contract, values: Object.freeze(values) }),
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

type Validated<tokens> = {
  [group in keyof tokens]: group extends keyof Tokens
    ? ValidPalette<tokens[group], group>
    : never
}
type ValidPalette<palette, group> = palette extends undefined
  ? undefined
  : {
      [key in keyof palette]: key extends `${string}!${string}`
        ? never
        : ValidTree<palette[key], group>
    }

type ValidTree<tree, group> = tree extends string | number
  ? group extends 'borderRadius' | 'spacing'
    ? tree extends Literal.Length
      ? Literal.Checked<tree>
      : never
    : Literal.Color & Literal.Checked<tree>
  : Extract<keyof tree, 'dark' | 'light'> extends never
    ? {
        [key in keyof tree]: key extends `${string}!${string}`
          ? never
          : ValidTree<tree[key], group>
      }
    : group extends 'borderRadius' | 'spacing'
      ? never
      : {
          readonly dark: Literal.Color &
            Literal.Checked<tree extends { dark: infer value } ? value : never>
          readonly light: Literal.Color &
            Literal.Checked<tree extends { light: infer value } ? value : never>
        } & Record<Exclude<keyof tree, 'dark' | 'light'>, never>
