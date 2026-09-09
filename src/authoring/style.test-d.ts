/**
 * Checks static style values against actual React style props and token inference.
 * @module
 */
import type * as React from 'react'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, style } from 'zyzz'

describe('style', () => {
  test('accepts native style props and preserves configured tokens', () => {
    const styles = { button: style({ color: '#fff', padding: '1rem' }) }
    expectTypeOf(styles.button).toExtend<React.CSSProperties>()
    expectTypeOf(styles.button).toEqualTypeOf<style.ReturnType>()
    const config = Config.create({ theme: { color: { brand: '#06c' } } })
    expectTypeOf(config.theme).toExtend<React.CSSProperties>()
    expectTypeOf(
      config.style({ color: 'brand' }),
    ).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(
      config.theme.style({ color: 'brand' }),
    ).toEqualTypeOf<style.ReturnType>()
    // @ts-expect-error Static values are not callable.
    styles.button()
    // @ts-expect-error Core imports have no theme tokens.
    style({ color: 'brand' })
    // @ts-expect-error Unknown properties remain errors.
    style({ colour: '#fff' })
    // @ts-expect-error Unknown configured tokens remain errors.
    config.style({ color: 'missing' })
    // @ts-expect-error Callbacks remain a preview until the dynamic compiler lands.
    style((values: { width: string }) => ({ width: values.width }))
    // @ts-expect-error Native CSS checking is not globally widened.
    const invalid: React.CSSProperties = { colour: '#fff' }
    void invalid
  })
})
