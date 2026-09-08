/**
 * Checks the public Vite entrypoint without widening its plugin contract.
 * @module
 */
import type { Plugin } from 'vite'
import { expectTypeOf } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

expectTypeOf(zyzz()).toEqualTypeOf<Plugin>()
// @ts-expect-error Plugin configuration is owned by Vite.
zyzz({ root: '.' })
