/** Route-local authoring exercised through TanStack's real route splitter. @module */
/** Physical application sources for Router and Start development and production. */
export const files = {
  'index.html':
    '<div id="root"></div><script type="module" src="/main.tsx"></script>',
  'main.tsx': `import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { getRouter } from './router'
createRoot(document.getElementById('root')!).render(<RouterProvider router={getRouter()} />)`,
  'router.tsx': `import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
export function getRouter() { return createRouter({ routeTree }) }`,
  'settings.tsx': `import { createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { style } from 'zyzz'

export const Route = createFileRoute('/settings')({
  component: Page,
  errorComponent: ErrorPage,
  loader: ({ location }) => {
    if (location.search.error) throw new Error('fixture error')
    if (location.search.missing) throw notFound()
    return 'loaded'
  },
  notFoundComponent: NotFoundPage,
})

function Page() {
  const [opacity] = useState(0.4)
  useEffect(() => { document.querySelector('#page')!.setAttribute('data-hydrated', 'true') }, [])
  return <main id="page" {...styles.main()}>Settings<span id="dynamic" {...styles.dynamic({ opacity })}>Dynamic</span></main>
}
function ErrorPage() { return <main id="error" {...styles.error()}>Error</main> }
function NotFoundPage() { return <main id="missing" {...styles.missing()}>Missing</main> }

namespace styles {
  export const dynamic = style((values: { opacity: number }) => ({ opacity: values.opacity }))

  export const main = style({ padding: '24px' })

  export const error = style({ padding: '13px' })

  export const missing = style({ padding: '7px' })
}`,
  '__root.tsx': `import { createRootRoute, Outlet } from '@tanstack/react-router'
export const Route = createRootRoute({ component: () => <Outlet /> })`,
}
