/** Displays serialized configuration variables or the defaults. @module */
import { createFileRoute } from '@tanstack/react-router'
import * as Head from '../Head.js'
import { Page as VariablesPage } from '../pages/Variables.js'
import * as Variables from '../Variables.js'

export const Route = createFileRoute('/vars')({
  codeSplitGroupings: [],
  component: Page,
  validateSearch: (search: Record<string, unknown>) => ({
    v: Object.hasOwn(search, 'v')
      ? typeof search.v === 'string'
        ? search.v
        : JSON.stringify(search.v)
      : undefined,
  }),
  loaderDeps: (entry) => {
    const { search } = entry

    return { v: search.v }
  },
  loader: (entry) => {
    const { deps } = entry

    try {
      return { config: Variables.decode(deps.v), error: undefined }
    } catch (error) {
      return {
        config: undefined,
        error:
          error instanceof Error ? error.message : 'Invalid configuration.',
      }
    }
  },
  // Shared configurations in `?v=` point their canonical URL at the default variables.
  head: () =>
    Head.page({
      description:
        'Browse the Zyzz default theme variables, from colors and spacing to typography, shadows, and easing.',
      path: '/vars',
      title: 'Variables · Zyzz',
    }),
})

function Page() {
  const { config, error } = Route.useLoaderData()
  return <VariablesPage config={config} error={error} />
}
