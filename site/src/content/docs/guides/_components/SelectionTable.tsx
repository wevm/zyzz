/** Styles the selection comparison table in the Variants guide. @module */
import type { ReactNode } from 'react'
import { style } from '../../../../zyzz.config.js'

/** Keeps the guide's comparison scrollable without widening the page. */
export function SelectionTable(props: SelectionTable.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      tabIndex={0}
      {...styles.table()}
    >
      {props.children}
    </div>
  )
}

export declare namespace SelectionTable {
  /** Properties for the selection comparison table. */
  type Props = {
    /** Authored table content retained in the Markdown route. */
    children: ReactNode
    /** Accessible name for the scrollable region. */
    label: string
  }
}

namespace styles {
  export const table = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    marginBlock: 6,
    overflowX: 'auto',
    typography: 'copy.14',
    selectors: {
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px',
      },
      '& table': {
        borderCollapse: 'collapse',
        minWidth: '32rem !custom',
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
      '& td code': {
        typography: 'label.14.mono',
        fontSize: '15px !custom',
        color: 'foreground',
        backgroundColor: 'gray.100',
        borderRadius: 'sm',
        paddingInline: 1,
        whiteSpace: 'nowrap',
      },
    },
  })
}
