/** Exposes the Zyzz webpack build adapter. @module */
import { zyzz as unplugin } from '../unplugin/index.js'

/** Compiles project sources and emits `zyzz.css` into the bundler output directory. */
export const zyzz = unplugin.webpack
