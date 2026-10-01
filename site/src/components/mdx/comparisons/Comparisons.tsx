/** Page-specific comparison tables and an equivalent-output diagram. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Shows four authoring approaches converging on equivalent CSS declarations. */
export function EquivalentOutput() {
  return (
    <svg
      aria-label="Zyzz, Tailwind, StyleX, and vanilla-extract can express the same CSS declarations."
      role="img"
      viewBox="0 0 360 250"
      {...styles.diagram()}
    >
      <g fill="none" stroke="currentColor" strokeOpacity="0.3">
        <rect x="12" y="16" width="136" height="42" rx="8" />
        <rect x="12" y="74" width="136" height="42" rx="8" />
        <rect x="12" y="132" width="136" height="42" rx="8" />
        <rect x="12" y="190" width="136" height="42" rx="8" />
        <path d="M148 37H174V124H202 M148 95H174 M148 153H174 M148 211H174V124" />
        <path d="m196 119 6 5-6 5" />
        <rect x="212" y="91" width="136" height="66" rx="8" />
      </g>
      <g fill="currentColor" fontSize="14" textAnchor="middle">
        <text x="80" y="43">
          Zyzz
        </text>
        <text x="80" y="101">
          Tailwind CSS
        </text>
        <text x="80" y="159">
          StyleX
        </text>
        <text x="80" y="217">
          vanilla-extract
        </text>
        <text x="280" y="119">
          Same declarations
        </text>
        <text x="280" y="140" fontSize="12" opacity="0.7">
          color + padding
        </text>
      </g>
    </svg>
  )
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
  export const diagram = style({
    backgroundColor: 'light-dark(#f5f5f5, #111) !custom',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'foreground',
    display: 'block',
    marginBlock: 6,
    maxWidth: 'md',
    padding: 3,
    width: '100% !custom',
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
    minWidth: '600px !custom',
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
    '& p': { margin: 0 },
  })
}
