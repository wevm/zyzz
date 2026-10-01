/** Spaces the selection comparison table in the Variants guide. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Renders the guide's comparison with aligned, readable cells. */
export function SelectionTable(props: SelectionTable.Props) {
  return <div {...styles.table()}>{props.children}</div>
}

export declare namespace SelectionTable {
  /** Authored table content retained in Markdown output. */
  type Props = { children: ReactNode }
}

namespace styles {
  export const table = style({
    selectors: {
      '& table': { borderCollapse: 'collapse', width: '100% !custom' },
      '& th, & td': {
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        padding: 3,
        textAlign: 'left',
        verticalAlign: 'top',
      },
    },
  })
}
