/** Exercises large recipe selections and theme updates on Fabric. @module */
import * as React from 'react'
import {
  AppRegistry,
  PixelRatio,
  TurboModuleRegistry,
  View,
} from 'react-native'
import type { TurboModule } from 'react-native'
import { defineConfig } from 'zyzz/react-native/react'

const { Provider, variants } = defineConfig({
  defaultVars: 'base',
  vars: {
    alternate: {
      color: { background: { dark: '#ffff00', light: '#0000ff' } },
      spacing: { size: '160px' },
    },
    base: {
      color: { background: { dark: '#00ff00', light: '#ff0000' } },
      spacing: { size: '100px' },
    },
  },
})
const bridge = TurboModuleRegistry.get<
  TurboModule & { inspect(): Report['native'] }
>('NativeZyzz')
const pending = new Map<string, () => void>()
const renders = { button: 0 }
let choose: React.Dispatch<
  React.SetStateAction<Parameters<typeof styles.button>[0]>
>
let releases = 0
let view: View | null = null

/** Measurements and render counters from a native variant consumer. */
export type Report = {
  /** Measured native bounds. */
  readonly geometry: readonly {
    readonly height: number
    readonly id: string
    readonly pageX: number
    readonly pageY: number
    readonly width: number
  }[]
  /** Completed transition. */
  readonly name: string
  /** Native binding and update counters. */
  readonly native: {
    readonly batches: number
    readonly bindings: number
    readonly writes: number
  }
  /** Released callback refs. */
  readonly releases: number
  /** React render counts. */
  readonly renders: typeof renders
  /** Native pixel scale. */
  readonly scale: number
}

const Button = React.memo(function Button() {
  renders.button++
  const [selection, setSelection] =
    React.useState<Parameters<typeof styles.button>[0]>()
  choose = setSelection
  React.useLayoutEffect(() => pending.get('button')?.())
  const ref = React.useCallback((node: View | null) => {
    view = node
    return () => {
      releases++
      view = null
    }
  }, [])
  return <View ref={ref} testID="button" {...styles.button(selection)} />
})

function App() {
  const [colorScheme, setScheme] = React.useState<'dark' | 'light'>('light')
  const [selection, setSelection] = React.useState<'alternate' | 'base'>('base')
  const [tick, setTick] = React.useState(0)
  const content = React.useMemo(() => <Button />, [])
  React.useLayoutEffect(() => pending.get('app')?.())
  React.useEffect(() => {
    async function record(name: string) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      if (!bridge || !view) throw new Error('Native variant binding is absent.')
      const geometry = await new Promise<Report['geometry']>((resolve) =>
        view!.measure((_x, _y, width, height, pageX, pageY) =>
          resolve([{ height, id: 'button', pageX, pageY, width }]),
        ),
      )
      await fetch('__REPORT_URL__', {
        body: JSON.stringify({
          geometry,
          name,
          native: bridge.inspect(),
          releases,
          renders: { ...renders },
          scale: PixelRatio.get(),
        } satisfies Report),
        method: 'POST',
      })
    }
    async function change(id: string, update: () => void) {
      await new Promise<void>((resolve) => {
        pending.set(id, resolve)
        update()
      })
      pending.delete(id)
    }
    async function run() {
      await record('initial')
      await change('button', () =>
        choose({
          appearance: 'overlay',
          disabled: true,
          loading: true,
          scale: 'large',
          variant: 'secondary',
        }),
      )
      await record('choice')
      await change('app', () => setScheme('dark'))
      await record('scheme')
      await change('button', () =>
        choose({
          appearance: null,
          disabled: null,
          loading: null,
          scale: null,
          variant: null,
        }),
      )
      await record('nulls')
      await change('app', () => setSelection('alternate'))
      await record('vars')
      await change('button', () => choose({ scale: undefined }))
      await record('defaults')
      await change('app', () => setTick(1))
      await record('commit')
    }
    run().catch((error: unknown) =>
      fetch('__REPORT_URL__', {
        body: JSON.stringify({
          error: error instanceof Error ? error.stack : String(error),
        }),
        method: 'POST',
      }),
    )
  }, [])
  return (
    <View
      accessibilityLabel={`commit ${tick}`}
      style={{ flex: 1, paddingTop: 100 }}
    >
      <Provider colorScheme={colorScheme} vars={selection}>
        {content}
      </Provider>
    </View>
  )
}

namespace styles {
  export const button = variants({
    base: {
      backgroundColor: 'background',
      height: '20px !custom',
      width: 'size',
    },
    defaultVariants: {
      appearance: 'base',
      disabled: false,
      loading: false,
      scale: 'medium',
      variant: 'primary',
    },
    variants: {
      appearance: {
        base: {},
        inverse: { width: '120px !custom' },
        overlay: { width: '160px !custom' },
      },
      scale: {
        large: { height: '64px !custom' },
        medium: { height: '40px !custom' },
        small: { height: '24px !custom' },
      },
      variant: {
        primary: {},
        secondary: { width: '180px !custom' },
        tertiary: { width: '200px !custom' },
      },
      disabled: { false: {}, true: { height: '80px !custom' } },
      loading: { false: {}, true: { height: '96px !custom' } },
    },
    compoundVariants: [
      {
        when: { appearance: ['inverse', 'overlay'], variant: 'secondary' },
        style: { height: '72px !custom' },
      },
      {
        when: { disabled: true, loading: true },
        style: { height: '120px !custom', width: '240px !custom' },
      },
    ],
  })
}

AppRegistry.registerComponent('main', () => App)
