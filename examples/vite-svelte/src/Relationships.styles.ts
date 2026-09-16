/** Selects related elements using ordinary CSS and style identities. @module */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import { style } from './zyzz.config.js'

/** An empty identity style anchors selectors on the group's children and siblings. */
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

  export const group = style()

  export const item = style({
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    marginTop: 'sm',
    padding: 'sm',
    selectors: {
      [`${group} > &:nth-child(even)`]: { backgroundColor: 'backdrop' },
      [`${group}:hover &`]: { borderColor: 'accent' },
      [`${group}[data-active="true"] > &`]: { color: 'accent' },
    },
  })

  export const sibling = style({
    selectors: { [`${group} + &`]: { fontWeight: 600 } },
  })

  export const parent = style({
    selectors: { '&:has(input:checked)': { color: 'accent' } },
  })
}
