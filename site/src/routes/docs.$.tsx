/** Resolves documentation paths to authored MDX pages. @module */
import {
  createFileRoute,
  notFound,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import * as Manifest from '../Manifest.js'
import { Page as DocsPage } from '../pages/Docs.js'

export const Route = createFileRoute('/docs/$')({
  component: Page,
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
    framework:
      typeof search.framework === 'string' ? search.framework : undefined,
    mode: search.mode === 'custom' ? ('custom' as const) : ('default' as const),
  }),
  loader: (entry) => {
    const { params } = entry

    const path = (params._splat ?? '').replace(/\.md$/, '').replace(/\/$/, '')
    if (!Object.hasOwn(Manifest.pages, path)) throw notFound()
    const { title, description } = Manifest.pages[path]!
    return { path, title, description }
  },
  head: (entry) => {
    const { loaderData } = entry

    return {
      meta: [
        { title: `${loaderData?.title ?? 'Docs'} · Zyzz` },
        { name: 'description', content: loaderData?.description ?? '' },
      ],
    }
  },
})

function Page() {
  return <DocsPage path={Route.useLoaderData().path} />
}
