/**
 * Carries portable theme references and enforces their property domains.
 * @module
 */
import * as Binding from './Binding.js'
import type * as Query from './Query.js'
import type * as Shorthands from './Shorthands.js'
import type * as Theme from './Theme.js'
import type * as ValueSyntax from './Value.js'
import type * as VariableSets from '../Vars.js'
import * as Literal from './Literal.js'
import * as VariableData from './VariableSets.js'

/** Checks a reference's property domain. */
export function accepts(
  group: Group,
  property: keyof Literal.Properties,
): boolean {
  if (property.startsWith('--')) return true
  if (group === 'number' || group === 'string') return false
  if (group === 'color') return Literal.rule(property)?.kind === 'color'
  if (group === 'borderColor') return /^border.*Color$/.test(property)
  if (group === 'borderWidth')
    return /^border(?:Block|Inline)?(?:Start|End|Top|Right|Bottom|Left)?Width$/.test(
      property,
    )
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

/** Checks explicit variable values independently of shorthand category mappings. */
export function acceptsReference(
  reference: Reference,
  property: keyof Literal.Properties,
): boolean {
  if (!reference.contract.variableSet) return accepts(reference.group, property)
  if (property.startsWith('--')) return true
  function check(value: Value): boolean {
    if (is(value)) return acceptsReference(value, property)
    if (typeof value === 'object') return Object.values(value).every(check)
    if (typeof value === 'number') {
      const rule = Literal.rule(property)
      if (rule?.kind === 'number')
        return (
          value >= rule.min &&
          value <= rule.max &&
          (!rule.integer || Number.isInteger(value))
        )
      return value === 0 && Binding.accepts('length', property)
    }
    if (reference.group === 'color') return Binding.accepts('color', property)
    if (reference.group === 'spacing')
      return (
        (Literal.rule(property)?.kind === 'compound' &&
          accepts('spacing', property)) ||
        Binding.accepts(
          value.endsWith('%')
            ? value.startsWith('-')
              ? 'signedPercentage'
              : 'percentage'
            : value.startsWith('-')
              ? 'signedLength'
              : 'length',
          property,
        )
      )
    return (
      Literal.isLiteral(property, value) ||
      Literal.rule(property)?.kind === 'compound'
    )
  }
  return check(reference.value)
}

/** Rebinds validated scalar references to a explicitly owned contract identity. */
export function bind<tokens extends Theme.Tokens>(
  original: Theme.Definition<tokens>,
  contract: Contract,
): Theme.Definition<tokens> {
  type Tree = { [key: string]: Reference | Tree }

  const metadata = original[definition]
  const values = VariableData.rebind(metadata, contract)

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
                value: values[value.path]!,
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
      { value: Object.freeze({ ...metadata, contract, values }) },
    ),
  ) as Theme.Definition<tokens>
}

/** Retains full scopes when styles may have been compiled in another graph. */
export const complete = Symbol('zyzz.contract.complete')

/** Opaque data shared by a definition and its compatible extensions. */
export type Contract = {
  /** Whether values belong to independent variables rather than fixed theme categories. */
  readonly variableSet?: boolean | undefined
  /** Configuration-local category-to-property mappings. */
  readonly mappings?: VariableSets.Mappings | false | undefined
  /** Web emission mode retained by configuration-bound theme handles. */
  readonly cssOutput?: 'atomic' | 'grouped' | undefined
  /** Fallback layer for declarations without an explicit layer. */
  readonly defaultLayer?: string | undefined
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
export type Vars<tree> =
  tree extends Reference<infer group>
    ? Variable<group>
    : { readonly [key in keyof tree]: Vars<tree[key]> }

/** Creates web-only reference leaves without changing contract identities. */
export function variables<tree>(tree: tree): Vars<tree> {
  if (is(tree))
    return Object.freeze({
      ...tree,
      [web]: true as const,
    }) as unknown as Vars<tree>

  return Object.freeze(
    Object.fromEntries(
      Object.entries(tree as object).map(([key, value]) => [
        key,
        variables(value),
      ]),
    ),
  ) as Vars<tree>
}

/** Internal definition metadata; never enumerable consumer output. */
export const definition = Symbol('zyzz.theme')

/** Supported scalar token groups. */
export type Group =
  | 'number'
  | 'string'
  | 'backgroundColor'
  | 'borderColor'
  | 'borderRadius'
  | 'borderWidth'
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
  /** Original segments for typography paths containing query punctuation. */
  readonly paths?: Readonly<Record<string, readonly string[]>> | undefined
  readonly queries?: Query.Metadata | undefined
  readonly contract: Contract
  readonly values: Readonly<Record<string, Value>>
}

/** Literal domain carried by explicit variable references during type checking. */
export const scalar = Symbol('zyzz.variable.scalar')

/** Inferred shorthand names whose leaves belong to a property domain. */
export type Names<
  tokens,
  property extends keyof Literal.Properties,
> = tokens extends {
  readonly '~vars': { values: infer values; mappings: infer mappings }
}
  ? mappings extends false
    ? Paths<
        Omit<values, 'breakpoints' | 'containers' | 'containerNames'>,
        property
      >
    : {
        [category in keyof values]: category extends keyof mappings
          ? mappings[category] extends readonly unknown[]
            ? property extends mappings[category][number]
              ? Paths<values[category], property>
              : never
            : never
          : category extends Group
            ? property extends Properties<category>
              ? Paths<values[category], property>
              : never
            : never
      }[keyof values]
  : {
      [group in Extract<
        keyof tokens,
        Group
      >]: property extends Properties<group>
        ? Paths<NonNullable<tokens[group]>>
        : never
    }[Extract<keyof tokens, Group>]

type Paths<tree, property extends keyof Literal.Properties = never> = [
  tree,
] extends [never]
  ? never
  : string extends keyof tree
    ? string
    : {
        [key in Extract<keyof tree, number | string>]: NonNullable<
          tree[key]
        > extends Value
          ? [property] extends [never]
            ? PathKey<key>
            : VariableSets.Scalar<
                  NonNullable<tree[key]>
                > extends Literal.Properties[property] &
                  ValueSyntax.Checked<
                    Record<
                      property,
                      VariableSets.Scalar<NonNullable<tree[key]>>
                    >
                  >[property]
              ? PathKey<key>
              : never
          : `${key}.${Paths<NonNullable<tree[key]>, property>}`
      }[Extract<keyof tree, number | string>]

type PathKey<key extends number | string> =
  | key
  | `${key}`
  | (key extends `${infer numericKey extends number}`
      ? `${numericKey}` extends key
        ? numericKey
        : never
      : never)

/** Property domains accepted by each token group. */
export type Properties<group extends Group> = `--${string}` | Property<group>

type Property<group extends Group> = group extends 'number' | 'string'
  ? never
  : group extends 'margin' | 'padding'
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
            : group extends 'borderWidth'
              ? Exclude<
                  Extract<keyof Literal.Properties, `border${string}Width`>,
                  'borderImageWidth'
                >
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

/** Resolves configured token names, with specific color groups first. */
export function resolve(value: unknown, options: resolve.Options): unknown {
  if (
    options.property.startsWith('--') ||
    (typeof value !== 'string' && typeof value !== 'number')
  )
    return value

  const data = Object.getOwnPropertyDescriptor(options.theme, definition)
    ?.value as Metadata | undefined
  if (!data) throw new Error('Expected a theme definition.')

  const groups = [
    'backgroundColor',
    'borderColor',
    'borderRadius',
    'borderWidth',
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
  ] as const

  if (data.contract.variableSet) {
    for (const [path, entry] of Object.entries(data.values).sort(
      ([left], [right]) =>
        groups.indexOf(left.split('.')[0] as (typeof groups)[number]) -
        groups.indexOf(right.split('.')[0] as (typeof groups)[number]),
    )) {
      const [category, ...parts] = path.split('.')
      const mappings = data.contract.mappings
      const mapped = mappings === false ? undefined : mappings?.[category!]
      if (
        mappings === false
          ? path !== String(value)
          : parts.join('.') !== String(value) ||
            !(mapped
              ? mapped.includes(options.property)
              : accepts(category as Group, options.property))
      )
        continue
      return create({
        contract: data.contract,
        group: (() => {
          let leaf: unknown = Object.getOwnPropertyDescriptor(
            options.theme,
            'tokens',
          )?.value
          for (const key of path.split('.'))
            leaf =
              leaf && typeof leaf === 'object'
                ? Object.getOwnPropertyDescriptor(leaf, key)?.value
                : undefined
          return is(leaf) ? leaf.group : (category as Group)
        })(),
        path,
        value: entry,
      })
    }
    return value
  }

  // Specific groups precede shared colors regardless of authored group order.
  for (const group of groups) {
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

/** Whether the configured catalog supplies tokens for a property. */
export function mapped(
  theme: object,
  property: keyof Literal.Properties,
): boolean {
  if (property.startsWith('--')) return false
  const data = Object.getOwnPropertyDescriptor(theme, definition)
    ?.value as Metadata
  return Object.entries(data.values).some(([path]) => {
    const category = path.split('.')[0]!
    if (data.contract.mappings === false) {
      let leaf: unknown = Object.getOwnPropertyDescriptor(
        theme,
        'tokens',
      )?.value
      for (const key of path.split('.'))
        leaf =
          leaf && typeof leaf === 'object'
            ? Object.getOwnPropertyDescriptor(leaf, key)?.value
            : undefined
      return is(leaf) && acceptsReference(leaf, property)
    }
    const targets = data.contract.mappings?.[category]
    return targets
      ? targets.includes(property)
      : accepts(category as Group, property)
  })
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
  | Reference
  | { readonly dark: Value; readonly light: Value }
  | Conditions

/** Ordered conditional values with an unconditional fallback. */
export type Conditions = {
  readonly default: Value
  readonly [query: `@media ${string}`]: Value
}
