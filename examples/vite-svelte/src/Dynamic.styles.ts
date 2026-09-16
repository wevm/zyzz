/** Binds live values to static rules and shared registered variables. @module */
import { variable } from 'zyzz'
import { style } from './zyzz.config.js'

/** A registered, inherited variable assigned by a parent scope. */
export namespace variables {
  export const amount = variable('number', {
    inherits: true,
    initialValue: 0.5,
  })
}

/** A typed callback style and a variable-driven style share one slider. */
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

  export const bar = style((values: { width: `${number}%` }) => ({
    backgroundColor: 'accent',
    borderRadius: '0.5rem',
    height: '0.75rem',
    width: values.width,
  }))

  export const inherited = style({
    backgroundColor: 'muted',
    borderRadius: '0.5rem',
    height: '0.75rem',
    opacity: variables.amount,
    width: '100%',
  })

  export const scope = style({
    variables: { [variables.amount]: 0.5 },
  })

  export const track = style({
    backgroundColor: 'backdrop',
    borderRadius: '0.5rem',
    marginTop: 'md',
    overflow: 'hidden',
  })
}
