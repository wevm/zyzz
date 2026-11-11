/** Exposes the Zyzz Bun build adapter. @module */
import { zyzz as unplugin } from '../unplugin/index.js'

/** Compiles project sources and emits `zyzz.css` into the Bun build's `outdir`. */
export const zyzz = unplugin.bun
