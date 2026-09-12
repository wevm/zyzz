/**
 * Checks the public Next.js entrypoint without widening its configuration contract.
 * @module
 */
import type { NextConfig } from 'next'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/next'

describe('zyzz', () => {
  test('wraps a configuration object and rejects other configuration forms', () => {
    expectTypeOf(zyzz({ reactStrictMode: true })).toEqualTypeOf<NextConfig>()

    // @ts-expect-error Function-valued configurations remain unsupported.
    zyzz(() => ({ reactStrictMode: true }))

    // @ts-expect-error Asynchronous configurations remain unsupported.
    zyzz(Promise.resolve({ reactStrictMode: true }))

    // @ts-expect-error Unknown Next.js options are rejected by the configuration type.
    zyzz({ zyzz: true })
  })
})
