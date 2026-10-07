/** Defines the shared HTML document. @module */
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { script } from 'zyzz/default'
import reset from 'zyzz/reset.css?url'
import * as Head from '../Head.js'
import { vars } from '../zyzz.config.js'

/** Defines the document shell and page metadata. */
export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        href: reset,
        rel: 'stylesheet',
      },
      {
        href: '/favicon.ico',
        rel: 'icon',
        sizes: '32x32',
      },
      {
        href: '/favicon.svg',
        rel: 'icon',
        type: 'image/svg+xml',
      },
      {
        href: '/apple-touch-icon.png',
        rel: 'apple-touch-icon',
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
      // Pages set their own title and description with `Head.page`.
      {
        title: 'Zyzz',
      },
      {
        content: `${Head.origin}/og.png`,
        property: 'og:image',
      },
      {
        content:
          'Universal styles for modern interfaces, beside a Zyzz code example that styles a button',
        property: 'og:image:alt',
      },
      {
        content: '630',
        property: 'og:image:height',
      },
      {
        content: '1200',
        property: 'og:image:width',
      },
      {
        content: 'Zyzz',
        property: 'og:site_name',
      },
      {
        content: 'website',
        property: 'og:type',
      },
      {
        content: 'summary_large_image',
        name: 'twitter:card',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument(props: RootDocument.Props) {
  const { children } = props

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

declare namespace RootDocument {
  /** Properties for the RootDocument component. */
  type Props = { children: ReactNode }
}
