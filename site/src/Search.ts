/** Defines the documentation search index and its tokenizer. @module */
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
