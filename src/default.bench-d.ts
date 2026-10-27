/**
 * Measures type instantiations of app-scale authoring against the bundled default theme,
 * whose token set is comparable to a production design system.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Default from 'zyzz/default'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const style: typeof Default.style
declare const variants: typeof Default.variants

/** Resolves the theme's token domains before any bench body is measured. */
export function baseline() {
  style({ color: 'gray.100', padding: 4 })
  variants({ base: { color: 'gray.100' } })
}

bench('default / token declarations', () => {
  style({
    alignItems: 'center',
    backgroundColor: 'background.primary',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'gray.1000',
    display: 'flex',
    gap: 2,
    paddingBlock: 1,
    paddingInline: 3,
  })
}).types([67583, 'instantiations'])

bench('default / mixed literal and token declarations', () => {
  style({
    borderWidth: '1px',
    boxShadow: 'sm',
    fontSize: 'sm',
    fontWeight: 'medium',
    height: 8,
    margin: '0 auto !custom',
    transition: 'transform 160ms cubic-bezier(0.34, 1.36, 0.64, 1) !custom',
    width: 'calc(100% - 16px) !custom',
  })
}).types([73596, 'instantiations'])

bench('default / nested conditions', () => {
  style({
    ':hover': { backgroundColor: 'gray.200' },
    ':active': { backgroundColor: 'gray.300', transform: 'scale(0.97)' },
    '&[aria-pressed="true"]': { color: 'blue.700' },
    '@media >=md': {
      padding: 4,
      ':focus-visible': { outlineColor: 'blue.700' },
    },
    color: 'gray.900',
    padding: 2,
  })
}).types([35090, 'instantiations'])

bench('default / repeated declarations', () => {
  // Every app repeats declarations across styles; repeats should hit cached checks.
  style({ color: 'gray.1000', display: 'flex', gap: 2, padding: 3 })
  style({ color: 'gray.1000', display: 'flex', gap: 2, padding: 3 })
  style({ color: 'gray.1000', display: 'flex', gap: 2, padding: 3 })
  style({ color: 'gray.1000', display: 'flex', gap: 2, padding: 3 })
}).types([11782, 'instantiations'])

bench('default / recipe', () => {
  const button = variants({
    base: {
      alignItems: 'center',
      borderRadius: 'md',
      display: 'inline-flex',
      fontWeight: 'medium',
      ':hover:not(:disabled)': { backgroundColor: 'gray.200' },
    },
    variants: {
      size: {
        sm: { fontSize: 'xs', height: 7, paddingInline: 2 },
        md: { fontSize: 'sm', height: 8, paddingInline: 3 },
        lg: { fontSize: 'base', height: 10, paddingInline: 4 },
      },
      tone: {
        neutral: { backgroundColor: 'background.primary', color: 'gray.1000' },
        primary: { backgroundColor: 'gray.1000', color: 'background.primary' },
        danger: { backgroundColor: 'red.100', color: 'red.900' },
      },
    },
    defaultVariants: { size: 'md', tone: 'neutral' },
    compoundVariants: [
      {
        when: { size: 'sm', tone: 'danger' },
        style: { fontWeight: 'semibold' },
      },
    ],
  })

  button({ size: 'lg', tone: 'primary' })
}).types([58878, 'instantiations'])
