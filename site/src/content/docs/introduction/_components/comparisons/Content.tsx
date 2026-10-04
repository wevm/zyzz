/** Page-specific comparison heading typography and tables. @module */
import type { ReactNode } from 'react'
import { style } from '../../../../../zyzz.config.js'

/** Applies heading typography within this comparison page. */
export function Content(props: Content.Props) {
  return <div {...styles.content()}>{props.children}</div>
}

export declare namespace Content {
  /** Worked comparison examples. */
  type Props = {
    /** Authored page content. */
    children: ReactNode
  }
}

/** Displays a comparison table with cell spacing and row separators. */
export function Table(props: Table.Props) {
  return (
    <div aria-label={props.label} role="region" {...styles.table()}>
      {props.children}
    </div>
  )
}

export declare namespace Table {
  /** Properties for a comparison table. */
  type Props = {
    /** Authored table content retained in the Markdown route. */
    children: ReactNode
    /** Accessible name for the table region. */
    label: string
  }
}

namespace styles {
  export const content = style({
    '@media (max-width: 1023px)': {
      '& > h2:first-of-type': { marginTop: 0 },
    },
    '& h3': {
      typography: 'heading.20',
      marginBlock: 6,
    },
  })

  export const table = style({
    typography: 'copy.14',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    marginBlock: 6,
    overflow: 'hidden',
    selectors: {
      '& table': { borderCollapse: 'collapse', width: '100% !custom' },
      '& th, & td': {
        color: 'gray.900',
        overflowWrap: 'anywhere',
        padding: 3,
        textAlign: 'left',
        verticalAlign: 'top',
      },
      '& thead th': { backgroundColor: 'gray.100', fontWeight: 'medium' },
      '& tbody th': { color: 'foreground', fontWeight: 'medium' },
      '& tbody th, & tbody td': {
        borderTop: '1px solid',
        borderColor: 'gray.400',
      },
      '& table p': { margin: 0 },
      '& code': { typography: 'label.14.mono' },
    },
  })
}
