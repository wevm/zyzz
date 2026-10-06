/** Exercises system appearance changes through platform-adaptive colors on Fabric. @module */
import * as React from 'react'
import {
  Appearance,
  AppRegistry,
  PixelRatio,
  TurboModuleRegistry,
  useColorScheme,
  View,
} from 'react-native'
import type { TurboModule } from 'react-native'
import { defineConfig } from 'zyzz/react-native'

const { Provider, style } = defineConfig({
  defaultVars: 'base',
  vars: {
    base: { color: { background: { dark: '#00ff00', light: '#ff0000' } } },
  },
})
const bridge = TurboModuleRegistry.get<
  TurboModule & { inspect(): Report['native'] }
>('NativeZyzz')
const pending = new Map<string, () => void>()
const refs = new Map<string, View>()

/** Native measurements and counters returned by the actual app. */
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
  readonly renders: { readonly box: number }
  /** Native pixel scale. */
  readonly scale: number
}

const renders = { box: 0 }

const Box = React.memo(function Box(props: Box.Props) {
  renders.box++
  return (
    <View
      ref={(node) => {
        if (node) refs.set(props.id, node)
      }}
      style={styles.box().style}
      testID={props.id}
    />
  )
})

namespace Box {
  export type Props = { readonly id: 'adaptive' | 'forced' }
}

function App() {
  const scheme = useColorScheme()
  const content = React.useMemo(
    () => (
      <>
        <Box id="adaptive" />
        <Provider colorScheme="light">
          <Box id="forced" />
        </Provider>
      </>
    ),
    [],
  )
  React.useLayoutEffect(() => pending.get(`scheme:${scheme}`)?.(), [scheme])
  React.useEffect(() => {
    async function record(name: string) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      if (!bridge) throw new Error('Fabric adapter is absent.')
      const geometry = await Promise.all(
        [...refs]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(
            (entry) =>
              new Promise<Report['geometry'][number]>((resolve) =>
                entry[1].measure((_x, _y, width, height, pageX, pageY) =>
                  resolve({ height, id: entry[0], pageX, pageY, width }),
                ),
              ),
          ),
      )
      await fetch('__REPORT_URL__', {
        body: JSON.stringify({
          geometry,
          name,
          native: bridge.inspect(),
          releases: 0,
          renders: { ...renders },
          scale: PixelRatio.get(),
        } satisfies Report),
        method: 'POST',
      })
    }
    async function appearance(scheme: 'dark' | 'light') {
      if (Appearance.getColorScheme() === scheme)
        return Appearance.setColorScheme(scheme)
      await new Promise<void>((resolve) => {
        pending.set(`scheme:${scheme}`, resolve)
        Appearance.setColorScheme(scheme)
      })
      pending.delete(`scheme:${scheme}`)
    }
    async function run() {
      await appearance('light')
      await record('initial')
      await appearance('dark')
      await record('dark')
      await appearance('light')
      await record('commit')
      Appearance.setColorScheme('unspecified')
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
    <View style={{ backgroundColor: '#ffffff', flex: 1, paddingTop: 100 }}>
      <Provider colorScheme="system">{content}</Provider>
    </View>
  )
}

namespace styles {
  export const box = style({
    backgroundColor: 'background',
    height: '40px !custom',
    width: '100px !custom',
  })
}

AppRegistry.registerComponent('main', () => App)
