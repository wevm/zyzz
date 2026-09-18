/** Parses authoring modules while retaining TypeScript assertion syntax. @module */
import * as Parser from 'oxc-parser'

/** Parsed modules supplied by the host for a single compilation. */
export const cache = Symbol('parsed modules')

/** Preserves JSX authoring and retries TypeScript files with assertion-aware grammar. */
export function parse(options: parse.Options) {
  const settings = {
    // Unsupported hosts retain the JSON path.
    experimentalRawTransfer: Parser.rawTransferSupported(),
    preserveParens: false,
    showSemanticErrors: true,
    sourceType: 'module' as const,
  }
  const parsed = Parser.parseSync('source.tsx', options.source, settings)
  if (parsed.errors.length && /\.[cm]?ts$/.test(options.moduleId))
    return Parser.parseSync('source.ts', options.source, settings)
  return parsed
}

/** Source identity and syntax inputs. */
export declare namespace parse {
  /** Original module text with its declared file extension. */
  type Options = {
    /** Portable identity used to choose the TypeScript grammar. */
    readonly moduleId: string
    /** Unmodified authoring text. */
    readonly source: string
  }
}
