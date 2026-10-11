/**
 * Runs compiler operations in the native addon. The package.json `browser` field replaces this
 * module with `Engine.browser.ts`, so browser bundles never import Node built-ins.
 * @module
 */
import * as Addon from '../../internal/Addon.js'
// The type import keeps both engines' contracts identical and the browser engine in the build.
import type * as Browser from './Engine.browser.js'

/**
 * Runs a named compiler operation on JSON input.
 * @param operation - Operation name, such as `css.compile`.
 * @param input - UTF-8 JSON input.
 * @returns UTF-8 JSON output, including encoded failures.
 */
export const call: typeof Browser.call = (operation, input) =>
  Addon.load().call(operation, input)
