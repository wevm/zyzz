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
      borderRadius: '7px',
      cursor: 'pointer',
      display: 'inline-flex',
      gap: '12px',
      justifyContent: 'center',
      textDecoration: 'none',
      ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '4px' },
      ':disabled': { cursor: 'not-allowed', opacity: 0.5 },
      '& svg': { flexShrink: 0 },
    },
    variants: {
      variant: {
        primary: {
          backgroundColor: '#fafafa',
          borderColor: '#fafafa',
          color: '#111',
          ':hover:not(:disabled)': { backgroundColor: '#ddd' },
        },
        secondary: {
          backgroundColor: '#191919',
          borderColor: '#303030',
          color: '#eee',
          ':hover:not(:disabled)': { backgroundColor: '#252525' },
        },
        ghost: {
          backgroundColor: 'transparent',
          color: '#999',
          ':hover:not(:disabled)': { color: '#fff' },
        },
      },
      size: {
        default: { padding: '15px 22px' },
        icon: { borderRadius: '4px', height: '32px', width: '32px' },
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  })
}
