import type { Style } from './Style.js'

/** A literal style object compiled to a class name. No CSS is produced at runtime.
 * @throws When the compiler or Vite plugin has not transformed this call.
 */
export function css(style: Style): string {
  void style
  throw new Error(
    'typestyle: css() must be compiled. Add typestyle/vite or run the standalone compiler.',
  )
}

/** Public token-aware style contracts. */
export type {
  Arbitrary,
  Color,
  Condition,
  Declarations,
  Global,
  Spacing,
  Style,
} from './Style.js'
