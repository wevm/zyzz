/** Resolves documentation paths to authored MDX pages. @module */
import {
  createFileRoute,
  notFound,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import * as Docs from '../Docs.js'
import * as Manifest from '../Manifest.js'
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
    if (!Object.hasOwn(Manifest.pages, path)) throw notFound()
    const { title, description } = Manifest.pages[path]!
    // Rendering reads the loaded page synchronously during SSR and client navigation.
    try {
      await Docs.load(path)
    } catch (error) {
      // A deployment can replace the hashed chunk under an open tab, so a full load fetches the current assets.
      if (typeof window !== 'undefined' && entry.cause !== 'preload')
        window.location.assign(entry.location.href)
      throw error
    }

    return { path, title, description }
  },
  head: (entry) => {
    const { loaderData } = entry
    const description = loaderData?.description ?? ''
    const title = `${loaderData?.title ?? 'Docs'} · Zyzz`

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:description', content: description },
        { property: 'og:title', content: title },
      ],
    }
  },
})

function Page() {
  return <DocsPage path={Route.useLoaderData().path} />
}
