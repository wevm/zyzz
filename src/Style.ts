import type * as CSS from 'csstype'
import type * as Tokens from './Tokens.js'
import type * as Properties from './internal/Properties.js'

/** Explicit escape hatch for a literal CSS value. Example: `[calc(100% - 2rem)]`. */
export type Arbitrary = `[${string}]`
/** Global CSS keywords supported in every declaration. */
export type Global = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset'
/** Geist palette token or a common scheme-independent color. */
export type Color =
  | keyof typeof Tokens.colors
  | 'transparent'
  | 'currentColor'
  | 'black'
  | 'white'
/** Numeric values use Tailwind's 0.25rem unit; `px` means one pixel. */
export type Spacing = number | 'px'

type Known<T> = T extends string ? (string extends T ? never : T) : T
type Domains = typeof Properties.domains
type Value<K extends keyof Domains> =
  | {
      space: Spacing
      offset: Spacing | 'auto'
      size:
        | Spacing
        | 'auto'
        | 'full'
        | 'min-content'
        | 'max-content'
        | 'fit-content'
        | 'none'
      color: Color
      radius: keyof typeof Tokens.radius
      pixels: number
      shadow: keyof typeof Tokens.shadows
      font: keyof typeof Tokens.fonts
      easing: keyof typeof Tokens.easing
      duration: number
      keyword: K extends keyof CSS.Properties ? Known<CSS.Properties[K]> : never
      unitless: K extends keyof CSS.Properties
        ? Known<CSS.Properties[K]>
        : never
      weight:
        | 100
        | 200
        | 300
        | 400
        | 500
        | 550
        | 600
        | 700
        | 800
        | 900
        | 'normal'
        | 'bold'
      arbitrary: never
    }[Domains[K]]
  | Global
  | Arbitrary

/** Supported CSS properties, each restricted to its own token domain. */
export type Declarations = {
  readonly [K in keyof Domains]?: Value<K> | undefined
} & {
  /** Geist preset including family, size, leading, tracking, weight, and strong-child semantics. */
  readonly typography?: keyof typeof Tokens.typography | undefined
}
/** Static conditions. Breakpoints are mobile-first and ordered by size. */
export type Condition =
  | (typeof Properties.pseudos)[number]
  | `@${keyof typeof Tokens.breakpoints}`
  | '@hover'
  | '@motion-reduce'
  | `&[data-${string}]`
/** A static style object. Conditions can nest, including breakpoints around pseudo-classes. */
export type Style = Declarations & {
  readonly [K in Condition]?: Style | undefined
}
