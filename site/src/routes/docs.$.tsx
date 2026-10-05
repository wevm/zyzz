/** Resolves documentation paths to authored MDX pages. @module */
import {
  createFileRoute,
  notFound,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import * as Docs from '../Docs.js'
import { Page as DocsPage } from '../pages/Docs.js'

export const Route = createFileRoute('/docs/$')({
  component: Page,
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
    framework:
      typeof search.framework === 'string' ? search.framework : undefined,
    mode: search.mode === 'custom' ? ('custom' as const) : ('default' as const),
  }),
  loader: async (entry) => {
    const { params } = entry

    const path = (params._splat ?? '').replace(/\.md$/, '').replace(/\/$/, '')
    if (!Object.hasOwn(__DOCS__.pages, path)) throw notFound()
    const { title, description } = __DOCS__.pages[path]!
    // Rendering reads the loaded page synchronously during SSR and client navigation.
    await Docs.load(path)

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
