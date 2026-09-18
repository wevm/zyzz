/** Creates the router from the generated route tree. @module */
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'

/** TanStack Start calls this on the server and in the browser. */
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true })
}
