/** Page-specific comparison heading typography. @module */
import type { ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

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

namespace styles {
  export const content = style({
    '& h3': {
      typography: 'heading.20',
      marginBlock: 6,
    },
  })
}
