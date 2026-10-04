/** Collapses the Themes & Tokens guide's key reference table inside a note callout. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Renders a collapsed table that inherits the surrounding callout's tone. */
export function KeyTable(props: KeyTable.Props) {
  return (
    <details {...styles.details()}>
      <summary {...styles.summary()}>{props.summary}</summary>
      {props.children}
    </details>
  )
}

export declare namespace KeyTable {
  /** Properties for the collapsed key reference table. */
  type Props = {
    /** Authored table content retained in Markdown output. */
    children: ReactNode
    /** Label of the disclosure control. */
    summary: string
  }
}

namespace styles {
  export const details = style({
    selectors: {
      '& table': { borderCollapse: 'collapse', width: '100% !custom' },
      '& th, & td': {
        paddingBlock: 2,
        paddingInline: 3,
        textAlign: 'left',
        verticalAlign: 'top',
      },
      '& th': { fontWeight: 'medium' },
      '& td': { borderTop: '1px solid', borderColor: 'blue.400' },
      // The key column shrinks to its longest key so property lists get the remaining width.
      '& th:first-child, & td:first-child': {
        paddingLeft: 0,
        whiteSpace: 'nowrap',
        width: '1% !custom',
      },
      '& table + p': { marginTop: 3 },
    },
  })

  export const summary = style({
    cursor: 'pointer',
    fontWeight: 'medium',
    selectors: { 'details[open] > &': { marginBottom: 2 } },
  })
}
