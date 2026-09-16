/**
 * Measures type instantiations contributed by public Theme contracts.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Theme: typeof Zyzz.Theme

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  Theme.define({ color: { base: '#000' } }).style({ color: 'base' })
}

bench('define / scalar and scheme tokens', () => {
  Theme.define({
    backgroundColor: { surface: { dark: '#000', light: '#fff' } },
    borderRadius: { round: '1rem', sm: '4px' },
    color: { blue: { 500: '#06c', 700: '#036' }, brand: '#06c' },
    fontSize: { body: '1rem', heading: '2rem' },
    fontWeight: { medium: 500 },
    spacing: { 4: '1rem', 8: '2rem', md: '8px' },
    textColor: { foreground: '#000' },
  })
}).types([141500, 'instantiations'])

bench('define / query aliases', () => {
  const theme = Theme.define({
    breakpoints: { desktop: '64rem', tablet: '48rem' },
    containerNames: ['sidebar'],
    containers: { card: '24rem' },
    spacing: { gap: '4px' },
  })

  theme.style({
    '@container sidebar >=card': { display: 'grid' },
    '@media tablet..desktop': { ':hover': { padding: 'gap' } },
  })
}).types([24159, 'instantiations'])

bench('extend / overrides', () => {
  const theme = Theme.define({
    backgroundColor: { surface: { dark: '#000', light: '#fff' } },
    color: { blue: { 500: '#06c' } },
    spacing: { md: '1rem' },
  })

  Theme.extend(theme, {
    backgroundColor: { surface: '#fff' },
    spacing: { md: '2rem' },
  })
}).types([38490, 'instantiations'])

bench('style / token names and references', () => {
  const theme = Theme.define({
    color: { blue: { 500: '#06c' }, brand: '#06c' },
    spacing: { 4: '1rem', md: '2rem' },
  })

  theme.style({
    color: 'blue.500',
    margin: theme.tokens.spacing.md,
    padding: 4,
    width: theme.vars.spacing[4],
  })
}).types([49864, 'instantiations'])
