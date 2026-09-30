/** Defines the shared HTML document. @module */
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { script } from 'zyzz/default'
import reset from 'zyzz/reset.css?url'
import { vars } from '../zyzz.config.js'

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
    <html
      lang="en"
      suppressHydrationWarning
      {...vars({ colorScheme: 'light dark' })}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: script() }} />
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
