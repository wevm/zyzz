/** Creates the application router. @module */
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'

/** Creates a router for each application instance. */
export function getRouter() {
  return createTanStackRouter({
    defaultPreload: 'intent',
    routeTree,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
