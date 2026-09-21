/** Defines the shared HTML document. @module */
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import reset from 'zyzz/reset.css?url'
import { style } from '../zyzz.config.js'

/** Defines the document shell and page metadata. */
export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        href: reset,
        rel: 'stylesheet',
      },
    ],
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        content: 'width=device-width, initial-scale=1',
        name: 'viewport',
      },
      {
        title: 'Zyzz',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body {...styles.body()}>
        {children}

        <Scripts />
      </body>
    </html>
  )
}

namespace styles {
  export const body = style({ fontFamily: 'system-ui, sans-serif' })
}
