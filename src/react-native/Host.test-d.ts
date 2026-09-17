/** Verifies host lifecycle inference through the public native entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Host, StyleSheet } from 'zyzz/react-native'
import { Native, type NativeDynamic } from 'zyzz/runtime'

describe('create', () => {
  test('retains scalar inputs, opaque overrides, and typed preprocessing', () => {
    const host = Host.create({
      colorScheme: 'light',
      density: 2,
      fontScale: 1,
      highContrast: false,
      platform: 'ios',
      reducedMotion: false,
      rtl: false,
      theme: 'default',
      preprocessors: {
        borderWidth: (_value, context) => context.hairlineWidth,
      },
    })
    const card = host.bind(() =>
      Native.create({
        axes: { size: ['small', 'large'] },
        defaults: { size: 'small' },
        styles: { 0: { opacity: 0.5 } },
      }),
    )
    const opaque = { current: 0.5 }
    const override = { opacity: opaque }
    expectTypeOf(card({ size: 'large', style: override })).toEqualTypeOf<
      Native.Props<{ readonly opacity: 0.5 } | typeof override>
    >()
    expectTypeOf(
      host.preprocess({ borderWidth: 'hairline', color: opaque }),
    ).toEqualTypeOf<{
      readonly borderWidth: number
      readonly color: typeof opaque
    }>()
    expectTypeOf(host.getSnapshot()).toEqualTypeOf<Host.Snapshot>()
    host.update({ theme: 'alternate', colorScheme: 'dark', density: 3 })
    // @ts-expect-error Platform is fixed for a host lifecycle.
    host.update({ platform: 'android' })
    // @ts-expect-error Scheme must be resolved by the device adapter.
    host.update({ colorScheme: 'system' })
    // @ts-expect-error Bound native callables retain finite variant inputs.
    card({ size: 'missing' })
    Host.create({
      ...host.getSnapshot(),
      preprocessors: {
        // @ts-expect-error Preprocessors consume unknown native values until narrowed.
        color: (value: string) => value,
      },
    })
    host.dispose()
  })

  test('preserves required and optional dynamic callable signatures', () => {
    function bind(
      host: ReturnType<typeof Host.create>,
      callback: NativeDynamic.Callable<{ alpha: number }>,
      recipe: NativeDynamic.RecipeCallable<{
        size?: { custom: { gap: string } }
      }>,
    ) {
      const bar = host.bind(() => callback)
      const card = host.bind(() => recipe)
      const opaque = { current: 0.5 }
      const override = { opacity: opaque }
      expectTypeOf(bar({ alpha: 0.5, style: override })).toEqualTypeOf<
        Native.Props<StyleSheet.NativeStyle | typeof override>
      >()
      expectTypeOf(card()).toEqualTypeOf<Native.Props>()
      // @ts-expect-error Host binding preserves required payload fields.
      bar()
      // @ts-expect-error Payload types survive host binding.
      card({ size: { custom: { gap: 3 } } })
    }
    expectTypeOf(bind).not.toBeAny()
  })
})
