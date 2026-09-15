/** Renders the document shell with the saved-selection script ahead of paint. @module */
import 'zyzz/reset.css'
import { script } from './zyzz.config'

export const metadata = { title: 'Zyzz playground' }

/** The root selection lives on <html>; the inline script restores it before hydration. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // The script changes root classes before React hydrates, so the mismatch is expected.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: script() }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
