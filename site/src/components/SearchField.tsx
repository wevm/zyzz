/** Provides the shared documentation and variables search field. @module */
import type { ComponentProps } from 'react'
import { style } from '../zyzz.config.js'

/** Renders a search input with the shared keyboard shortcut hint. */
export function SearchField(props: SearchField.Props) {
  return (
    <div {...styles.control()}>
      <input
        {...props}
        type="search"
        {...styles.input({
          className: props.className,
          style: props.style,
        })}
      />
      <kbd {...styles.shortcut()}>⌘K</kbd>
    </div>
  )
}

export declare namespace SearchField {
  /** Native input properties, including disabled placeholders and input refs. */
  type Props = Omit<ComponentProps<'input'>, 'type'>
}

namespace styles {
  export const control = style({
    maxWidth: 'xs',
    minWidth: 0,
    position: 'relative',
    width: '100% !custom',
  })

  export const input = style({
    typography: 'label.14',
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'foreground',
    paddingBlock: 2,
    paddingLeft: 3,
    paddingRight: 12,
    width: '100% !custom',
    '@media (max-width: 700px)': { paddingRight: 3 },
    ':disabled': { opacity: 1 },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const shortcut = style({
    typography: 'label.12',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'gray.900',
    padding: 1,
    pointerEvents: 'none',
    position: 'absolute',
    right: 2,
    top: '50% !custom',
    transform: 'translateY(-50%)',
    '@media (max-width: 700px)': { display: 'none' },
  })
}
