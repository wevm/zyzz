/** Styles the Stylesheets guide's authored tables. @module */
import type { ReactNode } from 'react'
import { style } from 'zyzz/default'

/** Displays a guide table with cell spacing and row separators. */
export function StylesheetTable(props: StylesheetTable.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      {...stylesheetTableStyles.table()}
    >
      {props.children}
    </div>
  )
}

export declare namespace StylesheetTable {
  /** Properties for a stylesheet guide table. */
  type Props = {
    /** Authored table content retained in the Markdown route. */
    children: ReactNode
    /** Accessible name for the table region. */
    label: string
  }
}

namespace stylesheetTableStyles {
  export const table = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    marginBlock: 6,
    overflowX: 'auto',
    typography: 'copy.14',
    selectors: {
      '& table': {
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        width: '100% !custom',
      },
      '& th, & td': {
        color: 'gray.900',
        padding: 3,
        textAlign: 'left',
        verticalAlign: 'top',
      },
      '& th': { backgroundColor: 'gray.100', fontWeight: 'medium' },
      '& td': { borderTop: '1px solid', borderColor: 'gray.400' },
      '& table p': { margin: 0 },
      '& code': { typography: 'label.14.mono' },
    },
  })
}
