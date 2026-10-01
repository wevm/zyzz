/** Page-specific comparison table and heading typography. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Applies heading typography within this comparison page. */
export function Content(props: Content.Props) {
  return <div {...styles.content()}>{props.children}</div>
}

export declare namespace Content {
  /** Comparison table and worked examples. */
  type Props = {
    /** Authored page content. */
    children: ReactNode
  }
}

/** Keeps comparison columns readable within a keyboard-scrollable region. */
export function Table(props: Table.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      tabIndex={0}
      {...styles.scroll()}
    >
      <table {...styles.table()}>{props.children}</table>
    </div>
  )
}

export declare namespace Table {
  /** Authored table sections and the accessible region name. */
  type Props = {
    /** Header and body rows rendered inside the table. */
    children: ReactNode
    /** Accessible name for the scrollable region. */
    label: string
  }
}

namespace styles {
  export const content = style({
    '& h3': {
      typography: 'heading.20',
      marginBlock: 6,
    },
  })

  export const scroll = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginBlock: 6,
    overflowX: 'auto',
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const table = style({
    typography: 'copy.14',
    borderCollapse: 'collapse',
    minWidth: '800px !custom',
    textAlign: 'left',
    width: '100% !custom',
    '& th, & td': {
      borderBottom: '1px solid',
      borderColor: 'gray.400',
      padding: 4,
      verticalAlign: 'top',
    },
    '& th': { color: 'foreground', fontWeight: 'medium' },
    '& thead': { backgroundColor: 'light-dark(#f5f5f5, #111) !custom' },
    '& tbody tr:last-child th, & tbody tr:last-child td': {
      borderBottom: 'none',
    },
    '& th p, & td p': { margin: 0 },
  })
}
