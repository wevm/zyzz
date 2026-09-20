/** Exposes the Zyzz rollup build adapter. @module */
import { zyzz as unplugin } from '../unplugin/index.js'

/** Compiles project sources and emits `zyzz.css` into the bundler output directory. */
export const zyzz = unplugin.rollup
