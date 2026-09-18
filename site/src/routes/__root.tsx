/** Renders the shared HTML document. @module */
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { style, theme } from 'zyzz/default'
import { global } from 'zyzz/web'

global({
  '*': { boxSizing: 'border-box' },
  html: { colorScheme: 'light dark' },
})

export const Route = createRootRoute({
  head: () => ({
    links: [
      { href: 'https://fonts.googleapis.com', rel: 'preconnect' },
      {
        crossOrigin: 'anonymous',
        href: 'https://fonts.gstatic.com',
        rel: 'preconnect',
      },
      {
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono&display=swap',
        rel: 'stylesheet',
      },
    ],
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Zyzz' },
    ],
  }),
  shellComponent: Document,
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html className={theme.className} lang="en">
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
  export const body = style({
    backgroundColor: 'background.200',
    color: 'foreground',
    fontFamily: 'sans',
    margin: 0,
  })
}
