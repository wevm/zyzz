/** Defines the shared HTML document. @module */
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { style } from 'zyzz/default'
import reset from 'zyzz/reset.css?url'
import fonts from '../fonts.css?url'

/** Defines the document shell and page metadata. */
export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        href: fonts,
        rel: 'stylesheet',
      },
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
        title: 'Zyzz · Style with TypeScript',
      },
      {
        content:
          'Type-safe styles, variables, and themes. Compile to static CSS with Zyzz.',
        name: 'description',
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
  export const body = style({ typography: 'copy.16' })
}
