/** Shared button and link treatments for site actions. @module */
import type { ComponentProps } from 'react'
import type { Props } from 'zyzz'
import { variants } from '../zyzz.config.js'

/** Renders an action as a native button or a link when `href` is supplied. */
export function Button({
  variant,
  size,
  className,
  style,
  ...props
}: Button.Props) {
  const appearance = styles.button({ variant, size, className, style })
  if (typeof props.href === 'string') return <a {...props} {...appearance} />
  return <button type="button" {...props} {...appearance} />
}

export declare namespace Button {
  type Props = Props.Variants<typeof styles.button> &
    (
      | (ComponentProps<'button'> & { href?: never })
      | (ComponentProps<'a'> & { href: string })
    )
}

namespace styles {
  export const button = variants({
    base: {
      typography: 'button.16',
      alignItems: 'center',
      border: '1px solid transparent',
      borderRadius: 'lg',
      cursor: 'pointer',
      display: 'inline-flex',
      gap: 3,
      justifyContent: 'center',
      textDecoration: 'none',
      ':focus-visible': {
        outline: '2px solid',
        outlineColor: 'gray.600',
        outlineOffset: '4px',
      },
      ':disabled': { cursor: 'not-allowed', opacity: 0.5 },
      '& svg': { flexShrink: 0 },
    },
    variants: {
      variant: {
        primary: {
          backgroundColor: 'foreground',
          borderColor: 'foreground',
          color: 'background.100',
          ':hover:not(:disabled)': { backgroundColor: 'gray.900' },
        },
        secondary: {
          backgroundColor: 'gray.100',
          borderColor: 'gray.400',
          color: 'foreground',
          ':hover:not(:disabled)': { backgroundColor: 'gray.200' },
        },
        // The reset clears native button backgrounds, so ghost sets none.
        ghost: {
          color: 'gray.900',
          ':hover:not(:disabled)': { color: 'foreground' },
        },
      },
      size: {
        default: { paddingBlock: 4, paddingInline: 6 },
        icon: { borderRadius: 'sm', height: 8, width: 8 },
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  })
}
