/** Styles the Tailwind guide's headings and migration reference tables. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Applies page-specific heading typography. */
export function TailwindContent(props: TailwindContent.Props) {
  return <div {...tailwindContentStyles.content()}>{props.children}</div>
}

export declare namespace TailwindContent {
  /** Properties for the migration guide content. */
  type Props = {
    /** Authored prose, examples, and tables. */
    children: ReactNode
  }
}

/** Keeps migration mappings scrollable without widening the page. */
export function TailwindTable(props: TailwindTable.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      tabIndex={0}
      {...tailwindContentStyles.table()}
    >
      {props.children}
    </div>
  )
}

export declare namespace TailwindTable {
  /** Properties for a migration mapping table. */
  type Props = {
    /** Authored table retained in the Markdown endpoint. */
    children: ReactNode
    /** Accessible name for the scrollable region. */
    label: string
  }
}

namespace tailwindContentStyles {
  export const content = style({
    minWidth: 0,
    selectors: {
      '& h3': { typography: 'heading.20', marginBlock: 6 },
    },
    '@media (max-width: 1023px)': {
      selectors: { '& > h2:first-of-type': { marginTop: 0 } },
    },
  })

  export const table = style({
    borderColor: 'gray.400',
    borderRadius: 'lg',
    borderStyle: 'solid !custom',
    borderWidth: '1px',
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
        tableLayout: 'fixed',
        width: '100% !custom',
      },
      '& th, & td': {
        borderTopColor: 'gray.400',
        borderTopStyle: 'solid !custom',
        borderTopWidth: '1px',
        color: 'gray.900',
        padding: 3,
        textAlign: 'left',
        verticalAlign: 'top',
      },
      '& thead th': { borderTopWidth: 0, fontWeight: 'medium' },
      '& th:first-child': { width: '40% !custom' },
      '& table :is(th, td) code': {
        backgroundColor: 'transparent !custom',
        borderRadius: '0px !custom',
        padding: 0,
        typography: 'label.13.mono',
      },
      '& table p': { margin: 0 },
    },
  })
}
