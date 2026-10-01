/** Uses client navigation for site pages and native links for other resources. @module */
import { Link as RouterLink } from '@tanstack/react-router'
import type { ComponentProps } from 'react'

/** Preserves authored URLs, including search parameters and Markdown downloads. */
export function Link(props: Link.Props) {
  const { href, target, ...attributes } = props
  const path = href?.split(/[?#]/)[0]

  if (!href || props.download !== undefined) return <a {...props} />

  if (
    path === '/' ||
    path === '/vars' ||
    path === '/docs' ||
    (path?.startsWith('/docs/') && !path.endsWith('.md'))
  )
    return (
      <RouterLink
        {...attributes}
        href={href}
        to={path}
        {...(target === undefined ? {} : { target })}
      />
    )

  return <a {...props} />
}

export declare namespace Link {
  type Props = ComponentProps<'a'>
}
