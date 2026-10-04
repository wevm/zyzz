/** Exercises third-party props and scoped animation targets on Fabric. @module */
import * as React from 'react'
import {
  AppRegistry,
  PixelRatio,
  StyleSheet,
  TurboModuleRegistry,
  View,
} from 'react-native'
import type { TurboModule } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { defineConfig, withStyles } from 'zyzz/react-native'
import {
  useAnimatedStyleValue,
  useAnimatedVars,
} from 'zyzz/react-native/reanimated'
import type { Report as UpdatesReport } from './Updates.js'

const { Provider, style, variants, vars } = defineConfig({
  defaultVars: 'base',
  vars: {
    alternate: {
      color: { background: { dark: '#ffff00', light: '#0000ff' } },
      spacing: { gap: '12px', size: '160px' },
    },
    base: {
      color: { background: { dark: '#00ff00', light: '#ff0000' } },
      spacing: { gap: '8px', size: '100px' },
    },
  },
})
const SafeView = withStyles(SafeAreaView)
const AnimatedView = withStyles(Animated.View)
const bridge = TurboModuleRegistry.get<
  TurboModule & { inspect(): UpdatesReport['native'] }
>('NativeZyzz')
const refs = new Map<string, View>()
const targets = new Map<string, Targets>()
const settled = new Map<string, Partial<Targets>>()
const pending = new Map<string, () => void>()
const renders = { motion: 0, nested: 0 }
const reactions = { motion: 0, nested: 0 }
const identities = { motion: true, nested: true }
let releases = 0
let choose: React.Dispatch<React.SetStateAction<Motion.Selection>>

type Targets = {
  readonly color: string
  readonly height: number
  readonly width: number
}

/** Native geometry, animation targets, and lifecycle counters. */
export type Report = Omit<UpdatesReport, 'renders'> & {
  readonly identities: typeof identities
  readonly reactions: typeof reactions
  readonly renders: typeof renders
  readonly targets: Readonly<Record<string, Targets>>
}

function finished(id: string, property: keyof Targets, value: number | string) {
  settled.set(id, { ...settled.get(id), [property]: value })
}

function changed(id: 'motion' | 'nested', value: Targets) {
  reactions[id]++
  targets.set(id, value)
}

const Motion = React.memo(function Motion(props: Motion.Props) {
  renders[props.id]++
  const [selection, setSelection] = React.useState<Motion.Selection>({})
  if (props.id === 'motion') choose = setSelection
  const values = useAnimatedVars(vars)
  const gap = useAnimatedVars(
    vars,
    (values) => values.spacing.gap * (selection.multiplier ?? 5),
  )
  const width = useAnimatedStyleValue(
    [
      styles.box({ wide: selection.wide }).style,
      selection.override ? { width: 120 } : undefined,
    ],
    'width',
  )
  const color = useAnimatedStyleValue(styles.box().style, 'backgroundColor')
  const first = React.useRef([values, gap, width, color])
  identities[props.id] =
    identities[props.id] &&
    first.current.every(
      (value, index) => value === [values, gap, width, color][index],
    )
  const id = props.id
  useAnimatedReaction(
    () => ({
      color: values.get().color.background,
      height: gap.get(),
      width: width.get(),
    }),
    (value: Targets) => scheduleOnRN(changed, id, value),
  )
  const animated = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      color.get(),
      { duration: 50 },
      (done: boolean | undefined) => {
        if (done) scheduleOnRN(finished, id, 'color', color.get())
      },
    ),
    height: withTiming(
      gap.get(),
      { duration: 50 },
      (done: boolean | undefined) => {
        if (done) scheduleOnRN(finished, id, 'height', gap.get())
      },
    ),
    width: withTiming(
      width.get(),
      { duration: 50 },
      (done: boolean | undefined) => {
        if (done) scheduleOnRN(finished, id, 'width', width.get())
      },
    ),
  }))
  const ref = React.useCallback(
    (node: View | null) => {
      if (!node) {
        if (refs.delete(id)) releases++
        return
      }
      refs.set(id, node)
      return () => {
        if (refs.delete(id)) releases++
      }
    },
    [id],
  )
  const mixed = React.useCallback((node: View | null) => {
    if (!node) {
      if (refs.delete('mixed')) releases++
      return
    }
    refs.set('mixed', node)
    return () => {
      if (refs.delete('mixed')) releases++
    }
  }, [])
  React.useLayoutEffect(() => pending.get(id)?.())
  return (
    <>
      <Animated.View ref={ref} style={[native.box, animated]} />
      {id === 'motion' ? (
        <AnimatedView
          ref={mixed}
          style={[styles.safe().style, native.box, animated]}
        />
      ) : undefined}
    </>
  )
})

namespace Motion {
  export type Props = { readonly id: 'motion' | 'nested' }
  export type Selection = {
    readonly multiplier?: number | undefined
    readonly override?: boolean | undefined
    readonly wide?: boolean | undefined
  }
}

const Aliased = React.memo(function Aliased() {
  const applied = styles.safe().style
  const alias = applied
  const composed = [alias, { height: 20 }]
  const ref = React.useCallback((node: View | null) => {
    if (node) refs.set('alias', node)
    else refs.delete('alias')
  }, [])

  return <Animated.View ref={ref} style={composed} />
})

function App() {
  const [colorScheme, setScheme] = React.useState<'dark' | 'light'>('light')
  const [selection, setSelection] = React.useState<'alternate' | 'base'>('base')
  const [visible, setVisible] = React.useState(true)
  const [tick, setTick] = React.useState(0)
  const content = React.useMemo(() => <Motion id="motion" />, [])
  const nested = React.useMemo(
    () => (
      <Provider colorScheme="light" vars="base">
        <Motion id="nested" />
      </Provider>
    ),
    [],
  )
  const ref = React.useCallback((node: View | null) => {
    if (!node) return
    refs.set('safe', node)
    return () => {
      releases++
      refs.delete('safe')
    }
  }, [])
  React.useLayoutEffect(() => pending.get('app')?.())
  React.useEffect(() => {
    async function change(id: string, update: () => void) {
      await new Promise<void>((resolve) => {
        pending.set(id, resolve)
        update()
      })
      pending.delete(id)
    }
    async function record(name: string, expected: Targets | undefined) {
      const deadline = Date.now() + 5_000
      let geometry: Report['geometry'] = []
      while (Date.now() < deadline) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
        geometry = await Promise.race([
          Promise.all(
            [...refs].map((entry) => {
              const [id, view] = entry
              return new Promise<Report['geometry'][number]>((resolve) =>
                view.measure((_x, _y, width, height, pageX, pageY) =>
                  resolve({ height, id, pageX, pageY, width }),
                ),
              )
            }),
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Native measurement timed out for ${[...refs.keys()].join(', ')}.`,
                  ),
                ),
              5_000,
            ),
          ),
        ])
        const motion = geometry.find((view) => view.id === 'motion')
        const completed = settled.get('motion')
        if (
          !expected ||
          (motion &&
            Math.round(motion.width) === expected.width &&
            Math.round(motion.height) === expected.height &&
            completed?.color === expected.color &&
            completed?.width === expected.width &&
            completed?.height === expected.height)
        )
          break
      }
      const motion = geometry.find((view) => view.id === 'motion')
      if (
        expected &&
        (!motion ||
          Math.round(motion.width) !== expected.width ||
          Math.round(motion.height) !== expected.height ||
          settled.get('motion')?.color !== expected.color)
      )
        throw new Error(
          `Animation did not settle: ${JSON.stringify({ expected, geometry, settled: Object.fromEntries(settled) })}`,
        )
      if (!bridge) throw new Error('Native bridge is absent.')
      await fetch('__REPORT_URL__', {
        body: JSON.stringify({
          geometry,
          identities: { ...identities },
          name,
          native: bridge.inspect(),
          reactions: { ...reactions },
          releases,
          renders: { ...renders },
          scale: PixelRatio.get(),
          targets: Object.fromEntries(targets),
        } satisfies Report),
        method: 'POST',
      })
    }
    async function run() {
      await record('initial', { color: '#ff0000', height: 40, width: 100 })
      await change('app', () => setScheme('dark'))
      await record('scheme', { color: '#00ff00', height: 40, width: 100 })
      await change('motion', () => choose({ wide: true }))
      await record('choice', { color: '#00ff00', height: 40, width: 200 })
      await change('app', () => setSelection('alternate'))
      await record('vars', { color: '#ffff00', height: 60, width: 200 })
      await change('motion', () => choose({ override: true, wide: true }))
      await record('override', { color: '#ffff00', height: 60, width: 120 })
      await change('motion', () => choose({ multiplier: 3 }))
      await record('inputs', { color: '#ffff00', height: 36, width: 160 })
      await change('app', () => setVisible(false))
      await record('unmount', undefined)
      await change('app', () => setScheme('light'))
      await change('app', () => setVisible(true))
      await record('remount', { color: '#0000ff', height: 60, width: 160 })
      await change('app', () => setTick(1))
      await record('commit', { color: '#0000ff', height: 60, width: 160 })
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
    <SafeAreaProvider>
      <View accessibilityLabel={`commit ${tick}`} style={native.root}>
        <Provider colorScheme={colorScheme} vars={selection}>
          <SafeView edges={[]} ref={ref} style={styles.safe().style} />
          <Aliased />
          {visible ? content : undefined}
          {nested}
        </Provider>
      </View>
    </SafeAreaProvider>
  )
}

namespace styles {
  export const box = variants({
    base: { backgroundColor: 'background', width: 'size' },
    defaultVariants: { wide: false },
    variants: { wide: { false: {}, true: { width: '200px !custom' } } },
  })
  export const safe = style({
    backgroundColor: 'background',
    height: '40px !custom',
    width: 'size',
  })
}

const native = StyleSheet.create({
  box: { marginTop: 20 },
  root: { flex: 1, paddingTop: 100 },
})
AppRegistry.registerComponent('main', () => App)
