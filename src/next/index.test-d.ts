/** Verifies source authoring and configuration through real Next.js and React types. @module */
import type { NextConfig } from 'next'
import type { ComponentProps } from 'react'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style } from 'zyzz'
import { zyzz } from 'zyzz/next'

describe('zyzz', () => {
  test('preserves synchronous asynchronous and phase-valued configurations', () => {
    expectTypeOf(zyzz({ reactStrictMode: true })).toEqualTypeOf<NextConfig>()
    expectTypeOf(
      zyzz(Promise.resolve({ reactStrictMode: true })),
    ).toEqualTypeOf<Promise<NextConfig>>()
    const config = zyzz(async (phase, { defaultConfig }) => ({
      ...defaultConfig,
      env: { phase },
    }))
    expectTypeOf(config).toEqualTypeOf<zyzz.Factory>()
  })

  test('spreads source callables into normal React props before transformation', () => {
    const staticStyle = style({ color: 'red' })
    const dynamic = style((values: { opacity: number }) => ({
      opacity: values.opacity,
    }))

    expectTypeOf(staticStyle()).toExtend<ComponentProps<'h1'>>()
    expectTypeOf(staticStyle({ style: { opacity: 0.5 } })).toExtend<
      ComponentProps<'h1'>
    >()
    expectTypeOf(dynamic({ opacity: 0.5 })).toExtend<ComponentProps<'button'>>()
    // @ts-expect-error Output compatibility must not widen authoring overrides.
    staticStyle({ style: { opacity: 'opaque' } })
  })
})
