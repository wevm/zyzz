/** Demonstrates independent viewport, container, support, and scope conditions. @module */
import { style } from './zyzz.config.js'

/** Container, media alias, supports, and scope conditions on one element. */
export namespace styles {
  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = style({ color: 'subtle', fontSize: '0.875rem' })

  export const row = style({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const container = style((values: { width: `${number}%` }) => ({
    containerName: 'preview',
    containerType: 'inline-size',
    maxWidth: '100%',
    width: values.width,
  }))

  export const content = style({
    backgroundColor: 'backdrop',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    display: 'grid',
    gap: 'sm',
    marginTop: 'md',
    padding: 'sm',
    '@container preview >=card': {
      gridTemplateColumns: '1fr 1fr',
      padding: 'md',
    },
    '@media wide': { borderWidth: '2px' },
    '@supports (text-wrap: balance)': { textWrap: 'balance' },
    '@scope (&) to (.scope-stop)': { '& strong': { color: 'accent' } },
  })
}
