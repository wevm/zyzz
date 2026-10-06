/** Ranks documentation pages for a search query with Cloudflare AI Search. @module */
import * as Manifest from './Manifest.js'
import type * as Search from './Search.js'

/** Answers `POST /api/search` with up to ten matching pages, or 503 when AI Search is unreachable. */
export async function respond(
  request: Request,
  binding: Binding | undefined,
): Promise<Response> {
  const query = await (async () => {
    try {
      const body: unknown = await request.json()
      if (
        typeof body !== 'object' ||
        body === null ||
        !('query' in body) ||
        typeof body.query !== 'string'
      )
        return undefined
      return body.query.trim()
    } catch {
      return undefined
    }
  })()
  if (!query || query.length > 512)
    return Response.json(
      { error: 'Expected a query of 1 to 512 characters.' },
      { status: 400 },
    )

  const chunks = await (async () => {
    // Deployments without the binding answer as if AI Search were unreachable.
    if (!binding) return undefined
    try {
      const response = await binding.search({
        ai_search_options: { retrieval: { max_num_results: 10 } },
        query,
      })
      return response.chunks
    } catch (error) {
      // The dialog keeps its keyword results when AI Search is unreachable, including on local servers.
      console.error(error)
      return undefined
    }
  })()
  if (!chunks)
    return Response.json(
      { error: 'AI Search is unavailable.' },
      { status: 503 },
    )

  // Chunks from one page collapse into its best match, and sources outside the docs are dropped.
  const results: Search.Match[] = []
  for (const chunk of chunks) {
    const path = page(String(chunk.item.metadata?.['url'] ?? chunk.item.key))
    if (!path || results.some((result) => result.href === `/docs/${path}`))
      continue

    results.push({
      href: `/docs/${path}`,
      score: chunk.score,
      text: chunk.text.slice(0, 240),
      title: Manifest.pages[path]!.title,
      titles: [],
      type: 'page',
    })
  }

  return Response.json({ results } satisfies Search.Matches, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

/** The part of an AI Search instance binding that search uses. */
export type Binding = {
  /** Returns the indexed chunks that best match a query. */
  search(options: {
    ai_search_options?:
      | { retrieval?: { max_num_results?: number | undefined } | undefined }
      | undefined
    query: string
  }): Promise<{
    chunks: readonly {
      item: {
        key: string
        metadata?: Record<string, unknown> | undefined
      }
      score: number
      text: string
    }[]
  }>
}

/** Worker bindings that search reads, declared in `wrangler.jsonc`. */
export type Env = {
  /** The `zyzz-search` AI Search instance. Calls throw on local servers without remote bindings. */
  AI_SEARCH?: Binding | undefined
}

/** Reads a published documentation path from a source URL or object key, such as `https://zyzz.sh/docs/guides/styling.md`. */
function page(source: string) {
  const path = source
    .match(/(?:^|\/)docs\/([^?#]+)/)?.[1]
    ?.replace(/(?:\/index)?(?:\.mdx?|\.html)?\/?$/, '')
  return path && Object.hasOwn(Manifest.pages, path) ? path : undefined
}
