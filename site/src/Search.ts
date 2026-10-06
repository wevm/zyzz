/** Defines the documentation search index and merges keyword results with AI Search results. @module */
import type { Options } from 'minisearch'

/** One searchable page, or one section under a `##` or `###` heading. */
export type Document = {
  /** Page path, with the heading anchor for sections, such as `/docs/guides/styling#overview`. */
  href: string
  /** Plain section text, including code. */
  text: string
  /** Heading text, or the page title for page entries. */
  title: string
  /** Page title and parent headings above a section, outermost first. */
  titles: readonly string[]
  /** Whether the entry covers a whole page or one of its sections. */
  type: 'page' | 'section'
}

/** A Document returned by the `/api/search` route, ranked by AI Search. */
export type Match = Document & {
  /** AI Search relevance between 0 and 1. */
  score: number
}

/** The `/api/search` response body. */
export type Matches = {
  /** One match per documentation page, best first. */
  results: readonly Match[]
}

/** Index and query options shared by the build and the browser, so serialized indexes load with the tokenizer that wrote them. */
export const options = {
  fields: ['title', 'titles', 'text'],
  idField: 'href',
  processTerm: stem,
  searchOptions: {
    boost: { text: 1, title: 4, titles: 2 },
    // A page entry ranks above its own sections when both match the same words.
    boostDocument: (_id, _term, stored) =>
      stored?.['type'] === 'page' ? 2 : 1,
    combineWith: 'AND',
    fuzzy: 0.2,
    prefix: true,
  },
  storeFields: ['href', 'text', 'title', 'titles', 'type'],
  tokenize,
} satisfies Options<Document>

/**
 * Merges keyword and AI Search results with weighted reciprocal rank fusion, keyed by `href`.
 * Ranks rather than raw scores decide the order, since keyword and AI scores use different scales.
 * An entry in both lists keeps the keyword copy, which carries the matched terms.
 */
export function fuse<result extends { href: string }>(
  options: fuse.Options<result>,
): readonly result[] {
  const { keyword, limit = 20, semantic } = options
  const entries = new Map<string, { result: result; score: number }>()

  for (const [list, weight] of [
    [keyword, 0.3],
    [semantic, 0.7],
  ] as const)
    list.forEach((result, rank) => {
      const entry = entries.get(result.href)
      const score = weight / (60 + rank + 1)
      if (entry) entry.score += score
      else entries.set(result.href, { result, score })
    })

  return [...entries.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result)
}

export declare namespace fuse {
  type Options<result> = {
    /** Keyword results, best first. */
    keyword: readonly result[]
    /** Maximum number of merged results. @default 20 */
    limit?: number | undefined
    /** AI Search results, best first. */
    semantic: readonly result[]
  }
}

/** Folds simple plurals, so `scopes` matches `scope`. Index and query terms pass through the same rule. */
export function stem(term: string): string {
  return term.length > 3 && term.endsWith('s') && !term.endsWith('ss')
    ? term.slice(0, -1)
    : term
}

/**
 * Splits text into lowercase words, adding the parts of camelCase identifiers.
 * `defineConfig` yields `defineconfig`, `define`, and `config`, so both the identifier and its words match.
 */
export function tokenize(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).flatMap((word) => {
    if (!word) return []

    const parts = word
      .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
      .toLowerCase()
      .split(' ')
    return parts.length > 1 ? [word.toLowerCase(), ...parts] : parts
  })
}
