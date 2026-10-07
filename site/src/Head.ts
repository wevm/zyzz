/** Builds the per-page metadata that search engines and link previews read. @module */

/** Production origin. Canonical and preview URLs on every deployment point here, so previews stay out of search results. */
export const origin = 'https://zyzz.style'

/** Returns a page's title, description, and canonical URL as route `head` tags. */
export function page(options: page.Options) {
  const { description, path, title } = options
  const url = `${origin}${path}`

  return {
    links: [{ href: url, rel: 'canonical' }],
    meta: [
      { title },
      { content: description, name: 'description' },
      { content: description, property: 'og:description' },
      { content: title, property: 'og:title' },
      { content: url, property: 'og:url' },
    ],
  }
}

export declare namespace page {
  type Options = {
    /** Summary for search results and link previews. */
    description: string
    /** Path without a query string, such as `/docs/guides/styling`. */
    path: string
    /** Document title, including the site name. */
    title: string
  }
}
