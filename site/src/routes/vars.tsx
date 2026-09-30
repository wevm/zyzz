/** Displays serialized configuration variables or the defaults. @module */
import { createFileRoute, Outlet } from '@tanstack/react-router'
import * as Variables from '../Variables.js'

export const Route = createFileRoute('/vars')({
  codeSplitGroupings: [],
  component: Page,
  validateSearch: (search: Record<string, unknown>) => ({
    v: typeof search.v === 'string' ? search.v : undefined,
  }),
  loaderDeps: ({ search }) => ({ v: search.v }),
  loader: ({ deps }) => {
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
  head: () => ({ meta: [{ title: 'Variables · Zyzz' }] }),
})

function Page() {
  return <Outlet />
}
