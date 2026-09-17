/** Checks payload inference while retaining caller-owned native override types. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { StyleSheet } from 'zyzz/react-native'
import type { Native, NativeDynamic } from 'zyzz/runtime'

describe('create', () => {
  test('preserves required fields and scoped payloads with opaque overrides', () => {
    function apply(
      callback: NativeDynamic.Callable<{ alpha: number }>,
      recipe: NativeDynamic.RecipeCallable<{
        size?: { custom: { gap: string } } | null
      }>,
    ) {
      const override = { opacity: { current: 0.5 } }
      expectTypeOf(callback({ alpha: 0.5, style: override })).toEqualTypeOf<
        Native.Props<StyleSheet.NativeStyle | typeof override>
      >()
      expectTypeOf(
        recipe({ size: { custom: { gap: '8px' } }, style: [null, override] }),
      ).toEqualTypeOf<Native.Props<StyleSheet.NativeStyle | typeof override>>()
      expectTypeOf(recipe()).toEqualTypeOf<Native.Props>()
      // @ts-expect-error Overrides do not make callback fields optional.
      callback({ style: override })
      // @ts-expect-error Dynamic payloads retain their field types.
      recipe({ size: { custom: { gap: 8 } }, style: override })
    }
    expectTypeOf(apply).not.toBeAny()
  })

  test('retains published required and optional inputs', () => {
    type Callback = NativeDynamic.From<
      (input: {
        alpha: number
        className?: string
        style?: { opacity?: number }
      }) => unknown
    >
    type Recipe = NativeDynamic.From<
      (input?: { size?: 'small'; className?: string }) => unknown
    >
    expectTypeOf<Callback>().toEqualTypeOf<
      NativeDynamic.Callable<{ alpha: number }>
    >()
    expectTypeOf<Recipe>().toEqualTypeOf<
      NativeDynamic.RecipeCallable<{ size?: 'small' }>
    >()
  })
})
