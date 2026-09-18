/** Renders the document shell with the saved-selection script ahead of paint. @module */
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import reset from 'zyzz/reset.css?url'
import { script } from '../zyzz.config.js'

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [{ href: reset, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: 'Zyzz playground' },
    ],
    // The initialization script runs before paint and before any route script.
    scripts: [{ children: script() }],
  }),
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

/** The root selection lives on <html>; the inline script restores it before hydration. */
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The script changes root classes before React hydrates, so the mismatch is expected.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
