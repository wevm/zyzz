/** Selects related elements using ordinary CSS and style identities. @module */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import { css } from './zyzz.config.js'

/** An empty identity style anchors selectors on the group's children and siblings. */
export namespace styles {
  export const section = css({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const group = css()

  export const item = css({
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

  export const sibling = css({
    selectors: { [`${group} + &`]: { fontWeight: 600 } },
  })

  export const parent = css({
    selectors: { '&:has(input:checked)': { color: 'accent' } },
  })
}
