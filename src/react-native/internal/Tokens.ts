/** Resolves portable references for native tables and callback expressions. @module */
import * as Calculation from './Calculation.js'
import type * as Scalar from './Scalar.js'
import type * as Style from '../../Style.js'
import * as Token from '../../internal/Token.js'

/** Identifies values whose behavior requires a web target. */
export class UnsupportedError extends Error {
  override name = 'Tokens.UnsupportedError'
}

/** Selects live token aliases and schemes without evaluating authored code. */
export function resolve(
  input: Style.Declaration['value'],
  options: resolve.Options,
): string | number {
  const active = new Set<Token.Reference>()
  function scalar(
    value: Token.Value | Style.Declaration['value'],
  ): string | number {
    if (typeof value === 'number' || typeof value === 'string') return value
    if (
      Token.is(value) &&
      !Object.getOwnPropertyDescriptor(value, Token.web)?.value
    ) {
      if (active.has(value))
        throw new Error('Native token aliases must not form a cycle.')
      const metadata = options.metadata
      const shared =
        metadata &&
        (metadata.contract === value.contract ||
          (metadata.contract[Token.identity] !== undefined &&
            metadata.contract[Token.identity] ===
              value.contract[Token.identity]))
      // A set sharing its contract with an extension lacks the extension's added paths.
      const next =
        shared && Object.hasOwn(metadata.values, value.path)
          ? metadata.values[value.path]!
          : value.value
      active.add(value)
      const result = scalar(next)
      active.delete(value)
      return result
    }
    if (Token.isExpression(value)) {
      const text = value.parts.map(scalar).join('')
      if (
        !('group' in value) ||
        value.group !== 'spacing' ||
        !/^\s*calc\(/i.test(text)
      )
        return text
      return `${Calculation.length(text, options) / (options.units?.px ?? 1)}px`
    }
    if (
      value &&
      typeof value === 'object' &&
      'light' in value &&
      'dark' in value
    ) {
      if (value.light !== value.dark)
        options.resolution.schemeIndependent = false
      return scalar(value[options.colorScheme])
    }
    if (value && typeof value === 'object' && 'default' in value)
      throw new UnsupportedError(
        'Media-conditioned variables require a web target.',
      )
    throw new UnsupportedError(
      'Web variables, expressions, and dynamic bindings are not native scalar tokens.',
    )
  }
  return scalar(input)
}

/** Native token selection and explicit unit conversion. */
export declare namespace resolve {
  /** Profile metadata and scheme independence shared by table preparation. */
  type Options = Scalar.Options & {
    readonly colorScheme: 'dark' | 'light'
    readonly metadata: Token.Metadata | undefined
    readonly resolution: { schemeIndependent: boolean }
  }
}
