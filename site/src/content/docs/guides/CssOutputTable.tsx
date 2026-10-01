/** Styles the CSS Output page's authored comparison. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Keeps output mode descriptions readable on narrow screens. */
export function CssOutputTable(props: CssOutputTable.Props) {
  return <div {...styles.table()}>{props.children}</div>
}

export declare namespace CssOutputTable {
  /** Authored table content retained by the Markdown route. */
  type Props = { children: ReactNode }
}

namespace styles {
  export const table = style({
    borderColor: 'gray.400',
    borderRadius: 'lg',
    borderStyle: 'solid !custom',
    borderWidth: '1px',
    marginBlock: 6,
    overflowX: 'auto',
    typography: 'copy.14',
    selectors: {
      '& table': {
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        width: '100% !custom',
      },
      '& thead th': { borderTopWidth: 0 },
      '& th, & td': {
        borderTopColor: 'gray.400',
        borderTopStyle: 'solid !custom',
        borderTopWidth: '1px',
        color: 'gray.900',
        paddingBlock: 3,
        paddingInline: 2,
        textAlign: 'left',
        verticalAlign: 'top',
      },
      '& th': { fontWeight: 'medium' },
      '& th:first-child, & td:first-child': { width: '32% !custom' },
      '& td p': { margin: 0 },
      '& td code': {
        typography: 'label.14.mono',
        fontSize: '15px !custom',
        color: 'foreground',
        backgroundColor: 'gray.100',
        borderRadius: 'sm',
        paddingInline: 1,
      },
    },
  })
}
