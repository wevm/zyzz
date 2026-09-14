/**
 * Measures type instantiations contributed by public root css authoring.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading. Attest
// analyzes bench bodies without executing them.
declare const css: typeof Zyzz.css
declare const Theme: typeof Zyzz.Theme

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  css({ color: '#000' })
  Theme.define({ color: { base: '#000' } })
}

bench('css / literal declarations', () => {
  css({
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: '8px',
    color: '#111',
    display: 'flex',
    gap: '12px',
    padding: '1rem 2rem',
    width: 'calc(100% - 16px)',
  })
}).types([54678, 'instantiations'])

bench('css / fallbacks, importance, and templates', () => {
  css({
    color: ['#111', 'oklch(0.5 0.1 200)!'],
    padding: `${8}px`,
    position: 'sticky!',
    width: `calc(100% - ${16}px)`,
  })
}).types([24982, 'instantiations'])

bench('css / nested conditions', () => {
  css({
    ':hover': { color: '#222' },
    '&[data-active]': { opacity: 0.5 },
    '@container (width > 400px)': { display: 'grid' },
    '@media (width >= 800px)': { ':focus-visible': { outline: '2px solid' } },
    '@supports (display: grid)': { display: 'grid' },
  })
}).types([34668, 'instantiations'])

bench('css / dynamic callback', () => {
  const bar = css((values: { alpha: number; amount: `${number}%` }) => ({
    display: 'block',
    opacity: values.alpha,
    width: values.amount,
  }))

  bar({ alpha: 0.5, amount: '50%', className: 'external' })
}).types([19510, 'instantiations'])

bench('css / applied overrides', () => {
  const card = css({ color: '#fff', padding: '1rem' })

  card({ className: 'external', style: { opacity: 0.5 } })
  card()
}).types([10582, 'instantiations'])

bench('css / bound theme tokens', () => {
  const theme = Theme.define({
    color: { brand: '#06c', ink: { dark: '#fff', light: '#000' } },
    spacing: { 4: '1rem', md: '8px' },
  })

  theme.css({
    ':hover': { color: 'brand' },
    color: 'ink',
    padding: ['md', '2px!'],
    width: theme.tokens.spacing[4],
  })
}).types([64158, 'instantiations'])
