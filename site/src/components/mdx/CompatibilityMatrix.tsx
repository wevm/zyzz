/** Styles the Compatibility page's authored support matrices. @module */
import type { ReactNode } from 'react'
import { style } from '../../zyzz.config.js'

/** Keeps support tables readable and keyboard-scrollable on narrow screens. */
export function CompatibilityMatrix(props: CompatibilityMatrix.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      tabIndex={0}
      {...styles.matrix()}
    >
      {props.children}
    </div>
  )
}

export declare namespace CompatibilityMatrix {
  /** Properties for the page-specific matrix. */
  type Props = {
    /** Authored table content, also retained in the Markdown route. */
    children: ReactNode
    /** Accessible name for the scrollable table region. */
    label: string
  }
}

namespace styles {
  export const matrix = style({
    borderColor: 'gray.400',
    borderRadius: 'lg',
    borderStyle: 'solid !custom',
    borderWidth: '1px',
    marginBlock: 6,
    overflowX: 'auto',
    typography: 'copy.14',
    lineHeight: '22px !custom',
    '&:focus-visible': {
      outlineColor: 'blue.700',
      outlineOffset: '2px',
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
    '& table': {
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      width: '100% !custom',
    },
    '& caption': {
      color: 'gray.900',
      padding: 3,
      textAlign: 'left',
      typography: 'label.14',
    },
    '& th, & td': {
      borderTopColor: 'gray.400',
      borderTopStyle: 'solid !custom',
      borderTopWidth: '1px',
      padding: 3,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '& th': { color: 'gray.900', fontWeight: 'normal' },
    '& th:first-child': { width: '32% !custom' },
    '& td': { color: 'gray.900' },
    '& table p': { margin: 0 },
    '@media (max-width: 600px)': {
      '& th:first-child': { width: '36% !custom' },
    },
  })
}
