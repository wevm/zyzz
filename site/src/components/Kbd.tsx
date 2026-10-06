/** Renders keyboard keys for shortcut hints. @module */
import type { ComponentProps } from 'react'
import { style } from '../zyzz.config.js'

/** Renders one key or key combination, such as `⌘K` or `esc`. */
export function Kbd(props: Kbd.Props) {
  return (
    <kbd
      {...props}
      {...styles.key({ className: props.className, style: props.style })}
    />
  )
}

export declare namespace Kbd {
  /** Native `kbd` properties. Class names and styles apply after the key styles. */
  type Props = ComponentProps<'kbd'>
}

namespace styles {
  export const key = style({
    typography: 'label.12',
    alignItems: 'center',
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'gray.900',
    display: 'inline-flex',
    justifyContent: 'center',
    minWidth: 6,
    paddingBlock: 'px',
    paddingInline: 1,
  })
}
