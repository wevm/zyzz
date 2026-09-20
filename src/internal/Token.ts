/**
 * Carries portable theme references and enforces their property domains.
 * @module
 */
import type * as Binding from './Binding.js'
import type * as Query from './Query.js'
import type * as Shorthands from './Shorthands.js'
import type * as Theme from '../Theme.js'
import * as Literal from './Literal.js'

/** Checks a reference's property domain. */
export function accepts(
  group: Group,
  property: keyof Literal.Properties,
): boolean {
  if (property.startsWith('--')) return true
  if (group === 'color') return Literal.rule(property)?.kind === 'color'
  if (group === 'borderColor') return /^border.*Color$/.test(property)
  if (group === 'borderRadius') return /^border.*Radius$/.test(property)
  if (group === 'textColor') return property === 'color'

  if (group === 'margin')
    return property.startsWith('margin') && property !== 'marginTrim'

  if (group === 'padding') return property.startsWith('padding')
  if (group === 'spacing' && property === 'marginTrim') return false

  if (group === 'spacing')
    return (
      /^(padding|margin|inset|scrollPadding)/.test(property) ||
      [
        'blockSize',
        'bottom',
        'columnGap',
        'flexBasis',
        'gap',
        'height',
        'inlineSize',
        'left',
        'maxBlockSize',
        'maxHeight',
        'maxInlineSize',
        'maxWidth',
        'minBlockSize',
        'minHeight',
        'minInlineSize',
        'minWidth',
        'right',
        'rowGap',
        'textDecorationThickness',
        'textIndent',
        'textUnderlineOffset',
        'top',
        'width',
      ].includes(property)
    )

  return group === property
}

/** Rebinds validated scalar references to a explicitly owned contract identity. */
export function bind<tokens extends Theme.Tokens>(
  original: Theme.Definition<tokens>,
  contract: Contract,
): Theme.Definition<tokens> {
  type Tree = { [key: string]: Reference | Tree }

  function rebind(tree: Theme.References<Theme.Tokens>): Tree {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(tree).map(([key, value]) => [
          key,
          is(value)
            ? create({
                contract,
                group: value.group,
                path: value.path,
                value: value.value,
              })
            : rebind(value as Theme.References<Theme.Tokens>),
        ]),
      ),
    )
  }

  const tokens = rebind(original.tokens)

  return Object.freeze(
    Object.defineProperty(
      {
        get className() {
          return original.className
        },
        style: original.style,
        tokens,
        variants: original.variants,
        vars: variables(tokens),
      },
      definition,
      { value: Object.freeze({ ...original[definition], contract }) },
    ),
  ) as Theme.Definition<tokens>
}

/** Retains full scopes when styles may have been compiled in another graph. */
export const complete = Symbol('zyzz.contract.complete')

/** Opaque data shared by a definition and its compatible extensions. */
export type Contract = {
  /** Web emission mode retained by configuration-bound theme handles. */
  readonly cssOutput?: 'atomic' | 'grouped' | undefined
  /** Configuration-local property aliases, inherited by bound handles. */
  readonly shorthands?: Shorthands.Map | undefined
  readonly [complete]?: boolean | undefined
  readonly [identity]?: string | undefined
}

/** Constructs a frozen reference without registering global state. */
export function create(options: Omit<Reference, typeof reference>): Reference {
  return Object.freeze({ ...options, [reference]: true as const })
}

/** Ordered web expression segments retain live references until CSS emission. */
export type Expression = {
  /** Structured expression discriminator. */
  readonly [expression]: true
  /** Cooked text and live scalar theme references in authored order. */
  readonly parts: readonly (string | Reference | Binding.Reference)[]
}

/** Identifies structured web expressions independently of literal CSS text. */
export const expression = Symbol('zyzz.expression')

/** Recognizes compiler-owned expression data without invoking getters. */
export function isExpression(value: unknown): value is Expression {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, expression)?.value === true
  )
}

/** Builds an immutable expression from statically extracted segments. */
export function compose(
  parts: readonly (string | Reference | Binding.Reference)[],
): Expression {
  return Object.freeze({
    [expression]: true as const,
    parts: Object.freeze([...parts]),
  })
}

/** Marks web-only references distinctly from portable tokens. */
export const web = Symbol('zyzz.web.variable')

/** Web reference with the original token domain. */
export type Variable<group extends Group = Group> = `var(--${string})` &
  Reference<group> & {
    readonly [web]: true
  }

/** Replaces portable scalar leaves with web-only references. */
export type Variables<tree> =
  tree extends Reference<infer group>
    ? Variable<group>
    : { readonly [key in keyof tree]: Variables<tree[key]> }

/** Creates web-only reference leaves without changing contract identities. */
export function variables<tree>(tree: tree): Variables<tree> {
  if (is(tree))
    return Object.freeze({
      ...tree,
      [web]: true as const,
    }) as unknown as Variables<tree>

  return Object.freeze(
    Object.fromEntries(
      Object.entries(tree as object).map(([key, value]) => [
        key,
        variables(value),
      ]),
    ),
  ) as Variables<tree>
}

/** Internal definition metadata; never enumerable consumer output. */
export const definition = Symbol('zyzz.theme')

/** Supported scalar token groups. */
export type Group =
  | 'backgroundColor'
  | 'borderColor'
  | 'borderRadius'
  | 'color'
  | 'margin'
  | 'padding'
  | 'spacing'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineHeight'
  | 'textColor'

/** Stable package/module/binding identity supplied by source adapters. */
export const identity = Symbol('zyzz.contract.identity')

/** Recognizes references without invoking getters on untrusted style values. */
export function is(value: unknown): value is Reference {
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.getOwnPropertyDescriptor(value, reference)?.value !== true
  )
    return false

  if (!Object.isFrozen(value)) return false

  const fields = Object.getOwnPropertyDescriptors(value)

  return ['contract', 'group', 'path', 'value'].every(
    (key) => fields[key] && 'value' in fields[key]!,
  )
}

/** Immutable theme data carried directly by each definition. */
export type Metadata = {
  readonly queries?: Query.Metadata | undefined
  readonly contract: Contract
  readonly values: Readonly<Record<string, Value>>
}

/** Inferred shorthand names whose leaves belong to a property's domain. */
export type Names<tokens, property extends keyof Literal.Properties> = {
  [group in Extract<keyof tokens, Group>]: property extends Properties<group>
    ? Paths<NonNullable<tokens[group]>>
    : never
}[Extract<keyof tokens, Group>]

type Paths<tree> = [tree] extends [never]
  ? never
  : string extends keyof tree
    ? string
    : {
        [key in Extract<keyof tree, number | string>]: NonNullable<
          tree[key]
        > extends Value
          ?
              | key
              | `${key}`
              | (key extends `${infer numericKey extends number}`
                  ? `${numericKey}` extends key
                    ? numericKey
                    : never
                  : never)
          : `${key}.${Paths<NonNullable<tree[key]>>}`
      }[Extract<keyof tree, number | string>]

/** Property domains accepted by each token group. */
export type Properties<group extends Group> = `--${string}` | Property<group>

type Property<group extends Group> = group extends 'margin' | 'padding'
  ? Exclude<
      Extract<keyof Literal.Properties, `${group}${string}`>,
      'marginTrim'
    >
  : group extends 'spacing'
    ? Extract<
        keyof Literal.Properties,
        | `blockSize`
        | `bottom`
        | `columnGap`
        | `flexBasis`
        | `gap`
        | `height`
        | `inlineSize`
        | `inset${string}`
        | `left`
        | Exclude<
            Extract<keyof Literal.Properties, `margin${string}`>,
            'marginTrim'
          >
        | `maxBlockSize`
        | `maxHeight`
        | `maxInlineSize`
        | `maxWidth`
        | `minBlockSize`
        | `minHeight`
        | `minInlineSize`
        | `minWidth`
        | `padding${string}`
        | `right`
        | `rowGap`
        | `scrollPadding${string}`
        | `textDecorationThickness`
        | `textIndent`
        | `textUnderlineOffset`
        | `top`
        | `width`
      >
    : group extends 'textColor'
      ? 'color'
      : group extends 'color'
        ? {
            [property in keyof typeof Literal.rules]: (typeof Literal.rules)[property] extends {
              kind: 'color'
            }
              ? property
              : never
          }[keyof typeof Literal.rules]
        : group extends 'borderColor'
          ? Extract<keyof Literal.Properties, `border${string}Color`>
          : group extends 'borderRadius'
            ? Extract<keyof Literal.Properties, `border${string}Radius`>
            : group

/** Immutable portable reference retaining its defining fallback. */
export type Reference<group extends Group = Group> = {
  readonly [reference]: true
  readonly contract: Contract
  readonly group: group
  readonly path: string
  readonly value: Value
}

const reference = Symbol('zyzz.token')

/** Resolves shorthand tokens with literal precedence, with specific colors first. */
export function resolve(value: unknown, options: resolve.Options): unknown {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    Literal.isLiteral(options.property, value)
  )
    return value

  const data = Object.getOwnPropertyDescriptor(options.theme, definition)
    ?.value as Metadata | undefined
  if (!data) throw new Error('Expected a theme definition.')

  // Specific groups precede shared colors regardless of authored group order.
  for (const group of [
    'backgroundColor',
    'borderColor',
    'borderRadius',
    'margin',
    'padding',
    'spacing',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textColor',
    'color',
  ] as const) {
    if (!accepts(group, options.property)) continue

    const path = `${group}.${value}`
    if (Object.hasOwn(data.values, path))
      return create({
        contract: data.contract,
        group,
        path,
        value: data.values[path]!,
      })
  }

  return value
}

/** Input contract for theme token resolution. */
export declare namespace resolve {
  /** Property domain and immutable theme metadata supplied by style validation. */
  type Options = {
    readonly property: keyof Literal.Properties
    readonly theme: object
  }
}

/** Scalar values retained for each rendering target. */
export type Value =
  | number
  | string
  | { readonly dark: string; readonly light: string }
