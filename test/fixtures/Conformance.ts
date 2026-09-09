/**
 * Builds declaration probes from Zyzz rules for independent CSS grammar and type checks.
 * @module
 */
import * as CssTree from 'css-tree'
import * as Module from 'node:module'
import * as Literal from '../../src/internal/Literal.js'

/** One scalar declaration accepted by the public authoring boundary. */
export type Case = {
  /** Camel-case property name. */
  property: keyof typeof Literal.rules
  /** Literal value without Zyzz importance syntax. */
  value: string | number
}

/** Exhausts finite keywords and samples numeric, color, and unit boundaries. */
export function cases(): readonly Case[] {
  const output: Case[] = []
  const require = Module.createRequire(import.meta.url)
  // CSS Tree exposes units at runtime; its declaration file omits this field.
  const upstream = CssTree.lexer as CssTree.Lexer & {
    units: Record<string, readonly string[]>
  }
  const units: Record<string, unknown> = require('mdn-data/css/units.json')
  const syntaxes: Record<
    string,
    { syntax: string }
  > = require('mdn-data/css/syntaxes.json')
  const colors = ['named-color', 'system-color'].flatMap((name) =>
    syntaxes[name]!.syntax.split('|').map((value) => value.trim()),
  )
  for (const [property, rule] of Object.entries(Literal.rules)) {
    const values: (string | number)[] = [
      'inherit',
      'initial',
      'revert',
      'revert-layer',
      'unset',
    ]
    if (rule.kind === 'ratio')
      values.push(0, 2, 'auto', '16/9', 'auto 4 / 3', '1/0', '4 / 3 auto')
    if (rule.kind === 'rotate')
      values.push(
        'none',
        '90deg',
        'x 1turn',
        '0 1 0 45deg',
        '90deg 0 1 0',
        'calc(1turn / 4)',
      )
    if (rule.kind === 'scale')
      values.push('none', 2, '-1 2', '50% 100% 1', 'calc(1 + .5)')
    if (rule.kind === 'translate')
      values.push('none', 0, '10px 20% -3px', 'calc(50% - 10px) 0')
    if (rule.kind === 'transform')
      values.push(
        'none',
        'translate(10px,20%) rotate(45deg)',
        'matrix(1,0,0,1,20,30)',
        'scale3d(1,2,3)',
        'translate3d(10px,20%,30px)',
        'rotate3d(0,1,0,45deg)',
        'perspective(100px)',
        'skew(10deg,20deg)',
        'rotateX(calc(1turn / 2))',
        'translateX(1px)rotateY(20deg)',
      )
    if (rule.kind === 'line') {
      values.push(
        0,
        'none',
        'solid',
        'thin',
        'red',
        '1px solid red',
        'red 1px solid',
        'solid red 1px',
        'rgb(0 0 255) dashed calc(1px + 2px)',
      )
      if ('outline' in rule) values.push('auto', 'auto 1px red')
    }
    if (rule.kind === 'identifier') {
      values.push(...rule.keywords, '--Probe', '--other')
      if (!('dashed' in rule))
        values.push('Probe', 'name-with-dashes', '_name', 'éclair')
      if ('separator' in rule)
        values.push(
          rule.separator === 'comma' ? '--Probe, --other' : '--Probe --other',
        )
    }
    if (rule.kind === 'enum') {
      values.push(...rule.values)
      if ('groups' in rule)
        values.push(rule.groups.map((group) => group[0]).join(' '))
      if ('items' in rule)
        values.push(
          `${rule.values[0]} ${rule.values[1]}`,
          ...(rule.items === 4 ? [rule.values.slice(0, 4).join(' ')] : []),
        )
      if ('list' in rule) values.push(`${rule.values[0]}, ${rule.values[1]}`)
      if ('easing' in rule)
        values.push(
          'cubic-bezier(0, -1, 1, 2)',
          'steps(4, jump-none)',
          'linear(0, .5 30% 60%, 1)',
          'ease, steps(2, end)',
        )
    }
    if (rule.kind === 'color') {
      if ('items' in rule)
        values.push(
          'red rgb(0 0 255)',
          ...(rule.items === 4 ? ['red green blue gold'] : []),
        )
      if ('keywords' in rule) values.push(...rule.keywords)
      values.push(
        ...colors,
        '#123',
        '#1234',
        '#123456',
        '#12345678',
        'black',
        'white',
        'transparent',
        'currentColor',
        'rgb(255 0 0 / 50%)',
        'hsl(120deg 50% 50%)',
        'hwb(120 20% 30%)',
        'lab(50% 20 -30)',
        'lch(50 30 120)',
        'oklab(.5 .1 -.1)',
        'oklch(.5 .1 120)',
        ...[
          'a98-rgb',
          'display-p3',
          'display-p3-linear',
          'prophoto-rgb',
          'rec2020',
          'srgb',
          'srgb-linear',
          'xyz',
          'xyz-d50',
          'xyz-d65',
        ].map((space) => `color(${space} .1 .2 .3)`),
      )
    }
    if (rule.kind === 'number') {
      values.push('calc(1 + 1)', 'clamp(1, 2, 3)')
      if ('keywords' in rule) values.push(...rule.keywords)
      if ('list' in rule) values.push('0, 2.5, infinite')
      values.push(rule.min, Math.max(1, rule.min))
      if (Number.isFinite(rule.max)) values.push(rule.max)
      if (!('integer' in rule)) values.push(Math.max(rule.min, 0.5))
    }
    if (rule.kind === 'grid-tracks') {
      values.push(
        0,
        '1fr',
        '1fr 2fr',
        'minmax(calc(10px + 2px), 1fr)',
        'minmax(0, 1fr)',
        'fit-content(40%)',
        'minmax(min-content, 100px) 2fr',
      )
      if (rule.explicit)
        values.push(
          'none',
          'subgrid',
          '[start] repeat(3, minmax(0, 1fr)) [end]',
          'repeat(auto-fill, minmax(20px, 1fr))',
          '10px repeat(auto-fit, 20px) 30px',
        )
    }
    if (rule.kind === 'grid-line')
      values.push('auto', 1, -1, 2, 'span 1', 'span 2')
    if (rule.kind === 'time') {
      values.push('calc(1s + 20ms)', 'min(1s, 500ms)')
      if ('list' in rule) values.push('0s, 250ms, 1s')
      if ('keywords' in rule) values.push(...rule.keywords)
      for (const unit of Object.keys(units))
        for (const number of ['0', '1', '.5', '1e2', '-1']) {
          const value = `${number}${unit}`
          if (!Literal.validate(property as Case['property'], value))
            values.push(value)
        }
    }
    if (rule.kind === 'length') {
      values.push('calc(1px + 2px)', 'clamp(1px, 2px, 3px)')
      if ('axes' in rule) values.push('10px/20%', '1px 2px / 3px 4px 5px 6px')
      if ('items' in rule)
        values.push(
          '1px 2px',
          ...(rule.items === 4 ? ['1px 2px 3px', '1px 2px 3px 4px'] : []),
        )
      values.push(0)
      if (rule.auto) values.push('auto')
      if ('keywords' in rule) values.push(...rule.keywords)
      // The candidate vocabulary comes from upstream, not Zyzz's length-unit list.
      for (const unit of new Set([
        ...Object.keys(units),
        ...Object.values(upstream.units).flat(),
        '%',
        'Q',
      ]))
        for (const number of ['0', '1', '.5', '1e2', '-1']) {
          const value = `${number}${unit}`
          if (!Literal.validate(property as Case['property'], value))
            values.push(value)
        }
    }
    for (const value of new Set(values))
      output.push({ property: property as Case['property'], value })
  }
  return output
}

/** Uses the pinned MDN grammar, including referenced syntaxes, rather than CSS Tree's older bundled data. */
export function lexer() {
  const require = Module.createRequire(import.meta.url)
  const properties: Record<
    string,
    { syntax: string }
  > = require('mdn-data/css/properties.json')
  const syntaxes: Record<
    string,
    { syntax: string }
  > = require('mdn-data/css/syntaxes.json')
  return CssTree.fork({
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, entry]) => [name, entry.syntax]),
    ),
    types: Object.fromEntries(
      Object.entries(syntaxes).map(([name, entry]) => [name, entry.syntax]),
    ),
  }).lexer
}

/** Converts public property spelling to its standard CSS name. */
export function name(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Independent invalid and intentionally unsupported inputs shared by runtime and type probes. */
export const rejected = [
  { property: 'alignItems', value: 'middle' },
  { property: 'animationDelay', value: '0x10s' },
  { property: 'animationDuration', value: 0 },
  { property: 'animationDuration', value: '1px' },
  { property: 'appearance', value: 'native' },
  { property: 'color', value: 'not-a-color' },
  { property: 'containerType', value: 'normal size' },
  { property: 'containerType', value: 'size inline-size' },
  { property: 'containerType', value: 'scroll-state scroll-state' },
  { property: 'fieldSizing', value: 'auto' },
  { property: 'interpolateSize', value: 'auto' },
  { property: 'display', value: 'fleex' },
  { property: 'fill', value: 'url(#gradient)' },
  { property: 'fillRule', value: 'winding' },
  { property: 'floodColor', value: 'none' },
  { property: 'fontStretch', value: '120%' },
  { property: 'gridAutoColumns', value: '0x10fr' },
  { property: 'gridAutoFlow', value: 'row column' },
  { property: 'gridColumnStart', value: 'span 1.5' },
  { property: 'letterSpacing', value: '10%' },
  { property: 'maskMode', value: 'normal' },
  { property: 'maskSize', value: '1px 2px' },
  { property: 'padding', value: '0x10px' },
  { property: 'perspective', value: '50%' },
  { property: 'padding', value: '1 px' },
  { property: 'padding', value: '1qu' },
  { property: 'readingFlow', value: 'flex-visual grid-rows' },
  { property: 'readingOrder', value: 'auto' },
  { property: 'readingOrder', value: '1px' },
  { property: 'scrollSnapType', value: 'mandatory both' },
  { property: 'textDecorationLine', value: 'none underline' },
  { property: 'textDecorationLine', value: 'underline underline' },
  { property: 'textDecorationStyle', value: 'groove' },
  { property: 'textEmphasisPosition', value: 'over under' },
  { property: 'textEmphasisStyle', value: 'open filled' },
  { property: 'touchAction', value: 'pan-left pan-right' },
  { property: 'touchAction', value: 'auto pinch-zoom' },
  { property: 'textUnderlineOffset', value: 'from-font' },
] as const
