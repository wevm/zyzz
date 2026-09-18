/** Creates the site router for each request. @module */
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'

/** Creates a router with the generated file routes. */
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true })
}
