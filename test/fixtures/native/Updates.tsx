/** Exercises scoped updates and ref cleanup on the Fabric renderer. @module */
import * as React from 'react'
import {
  AppRegistry,
  PixelRatio,
  Text,
  TurboModuleRegistry,
  View,
} from 'react-native'
import type { TurboModule } from 'react-native'
import { defineConfig, useVars } from 'zyzz/react-native'

const { Provider, style, vars } = defineConfig({
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
const refs = new Map<string, View>()
const renders = { fixed: 0, free: 0, nested: 0, themed: 0, values: 0 }
let releases = 0
let resize: React.Dispatch<React.SetStateAction<number>>
let restyle: React.Dispatch<
  React.SetStateAction<'bound' | 'static' | 'unstyled'>
>

/** Native measurements and lifecycle counters returned by the actual app. */
export type Report = {
  readonly geometry: readonly {
    readonly height: number
    readonly id: string
    readonly pageX: number
    readonly pageY: number
    readonly width: number
  }[]
  readonly name: string
  readonly native: {
    readonly batches: number
    readonly bindings: number
    readonly writes: number
  }
  readonly releases: number
  readonly renders: typeof renders
  readonly scale: number
}

const Box = React.memo(function Box(props: Box.Props) {
  renders[props.id]++
  const [height, setHeight] = React.useState(40)
  const [mode, setMode] = React.useState<'bound' | 'static' | 'unstyled'>(
    'bound',
  )
  if (props.id === 'themed') {
    resize = setHeight
    restyle = setMode
  }
  React.useLayoutEffect(() => pending.get(props.id)?.())
  const ref = React.useCallback(
    (node: View | null) => {
      if (!node) return
      refs.set(props.id, node)
      return () => {
        releases++
        refs.delete(props.id)
      }
    },
    [props.id],
  )
  return (
    <View
      key={props.id}
      ref={ref}
      testID={props.id}
      style={[
        mode === 'bound'
          ? styles.box().style
          : mode === 'static'
            ? { backgroundColor: '#0000ff', width: 60 }
            : undefined,
        { height },
      ]}
    />
  )
})

namespace Box {
  export type Props = { readonly id: 'free' | 'nested' | 'themed' }
}

const Fixed = React.memo(function Fixed() {
  renders.fixed++
  return <View testID="fixed" {...styles.fixed()} />
})

const Values = React.memo(function Values() {
  renders.values++
  const color = useVars(vars, (values) => values.color.background)
  return <Text>{color}</Text>
})

function App() {
  const [colorScheme, setScheme] = React.useState<'dark' | 'light'>('light')
  const [selection, setSelection] = React.useState<'alternate' | 'base'>('base')
  const [mounted, setMounted] = React.useState(true)
  const [tick, setTick] = React.useState(0)
  const content = React.useMemo(
    () => (
      <>
        <Box id="themed" />
        <Fixed />
        <Values />
        <Provider colorScheme="dark" vars="alternate">
          <Box id="nested" />
        </Provider>
      </>
    ),
    [],
  )
  React.useLayoutEffect(() => pending.get('app')?.())
  React.useEffect(() => {
    let canceled = false
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
      const report: Report = {
        geometry,
        name,
        native: bridge.inspect(),
        releases,
        renders: { ...renders },
        scale: PixelRatio.get(),
      }
      await fetch('__REPORT_URL__', {
        body: JSON.stringify(report),
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
      await change('app', () => setScheme('dark'))
      await record('scheme')
      await change('app', () => setTick(1))
      await record('commit')
      await change('themed', () => resize(64))
      await record('height')
      await change('app', () => setSelection('alternate'))
      await record('vars')
      await change('app', () => setMounted(false))
      await record('unmount')
      await change('app', () => setMounted(true))
      if (canceled) return
      await record('remount')
      await change('themed', () => restyle('static'))
      await record('static')
      await change('themed', () => restyle('unstyled'))
      await record('unstyled')
      await change('themed', () => restyle('bound'))
      await record('rebound')
    }
    run().catch((error: unknown) =>
      fetch('__REPORT_URL__', {
        body: JSON.stringify({
          error: error instanceof Error ? error.stack : String(error),
        }),
        method: 'POST',
      }),
    )
    return () => {
      canceled = true
    }
  }, [])
  return (
    <View style={{ backgroundColor: '#ffffff', flex: 1, paddingTop: 100 }}>
      <Text>commit {tick}</Text>
      <Provider colorScheme={colorScheme} vars={selection}>
        {mounted && content}
      </Provider>
      <Box id="free" />
    </View>
  )
}

namespace styles {
  export const box = style({
    backgroundColor: 'background',
    height: '40px !custom',
    width: 'size',
  })

  export const fixed = style({
    backgroundColor: '#ffffff !custom',
    height: '40px !custom',
    width: '80px !custom',
  })
}

AppRegistry.registerComponent('main', () => App)
