/** Measures release-mode requests through validated native layout notifications. @module */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dimensions, PixelRatio, Platform, Text, View } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { fixtures } from './generated/index.js'

type Library = 'stylesheet' | 'unistyles' | 'zyzz'
type Kind = 'repeated' | 'unique' | 'dynamic' | 'variants' | 'theme'
type Operation = 'mount' | 'update' | 'remount'
type Scene = {
  library: Library
  kind: Kind
  count: 10 | 100 | 1000
  active: boolean
  key: number
}
type Sample = {
  library: Library
  kind: Kind
  count: number
  operation: Operation
  pass: number
  iteration: number
  milliseconds: number
}
type Pending = {
  scene: Scene
  seen: Set<number>
  start: number
  resolve: (value: number) => void
  reject: (error: Error) => void
}
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export default function App() {
  const [scene, setScene] = useState<Scene | null>(null)
  const [status, setStatus] = useState('Preparing native benchmarks')
  const pending = useRef<Pending | null>(null)
  const cleared = useRef<(() => void) | null>(null)
  const started = useRef(false)
  useLayoutEffect(() => {
    if (!scene) {
      cleared.current?.()
      cleared.current = null
    }
  }, [scene])

  useEffect(() => {
    if (started.current) return
    started.current = true
    const endpoint = `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:8765`
    async function run() {
      if (__DEV__) throw new Error('Native benchmarks require a release build')
      async function progress(message: string) {
        const response = await fetch(`${endpoint}/progress`, {
          method: 'POST',
          body: message,
        })
        if (!response.ok)
          throw new Error(`Progress collector returned ${response.status}`)
      }
      await progress('App started')
      const samples: Sample[] = []
      let key = 0
      async function clear() {
        await new Promise<void>((resolve) => {
          cleared.current = resolve
          setScene(null)
        })
        await frame()
      }
      async function measure(next: Scene, nativeThemeOnly = false) {
        await frame()
        return new Promise<number>((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.current = null
            reject(new Error(`Layout timeout: ${JSON.stringify(next)}`))
          }, 15000)
          pending.current = {
            scene: next,
            seen: new Set(),
            start: performance.now(),
            resolve: (value) => {
              clearTimeout(timer)
              pending.current = null
              resolve(value)
            },
            reject: (error) => {
              clearTimeout(timer)
              pending.current = null
              reject(error)
            },
          }
          if (next.kind === 'theme' && next.library === 'unistyles')
            UnistylesRuntime.setTheme(next.active ? 'alternate' : 'base')
          if (!nativeThemeOnly) setScene(next)
        })
      }
      for (const pass of [1, 2]) {
        const libraries: Library[] =
          pass === 1
            ? ['stylesheet', 'unistyles', 'zyzz']
            : ['zyzz', 'unistyles', 'stylesheet']
        for (const count of [10, 100, 1000] as const)
          for (const kind of [
            'repeated',
            'unique',
            'dynamic',
            'variants',
            'theme',
          ] as const)
            for (const library of libraries) {
              const message = `${library} / ${kind} / ${count} / pass ${pass}`
              setStatus(message)
              await progress(message)
              for (let iteration = -3; iteration < 20; iteration++) {
                if (key) await clear()
                const base: Scene = {
                  library,
                  kind,
                  count,
                  active: false,
                  key: ++key,
                }
                const mount = await measure(base)
                if (iteration >= 0)
                  samples.push({
                    ...base,
                    operation: 'mount',
                    pass,
                    iteration,
                    milliseconds: mount,
                  })
                const updates =
                  kind === 'dynamic' || kind === 'variants' || kind === 'theme'
                const next = { ...base, active: updates }
                if (updates) {
                  const update = await measure(
                    next,
                    kind === 'theme' && library === 'unistyles',
                  )
                  if (iteration >= 0)
                    samples.push({
                      ...next,
                      operation: 'update',
                      pass,
                      iteration,
                      milliseconds: update,
                    })
                }
                const remount = await measure({ ...next, key: ++key })
                if (iteration >= 0)
                  samples.push({
                    ...next,
                    operation: 'remount',
                    pass,
                    iteration,
                    milliseconds: remount,
                  })
              }
            }
      }
      await clear()
      const response = await fetch(`${endpoint}/results`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 1,
          metric: 'request-to-all-native-layout-events-ms',
          samples,
          environment: {
            platform: Platform.OS,
            osVersion: Platform.Version,
            pixelRatio: PixelRatio.get(),
            fontScale: PixelRatio.getFontScale(),
            window: Dimensions.get('window'),
            reactNative: Platform.constants.reactNativeVersion,
            hermes: !!Reflect.get(globalThis, 'HermesInternal'),
            development: __DEV__,
          },
        }),
      })
      if (!response.ok)
        throw new Error(`Result collector returned ${response.status}`)
      setStatus('Native benchmarks complete')
    }
    run().catch(async (error) => {
      setStatus(String(error))
      await fetch(`${endpoint}/error`, {
        method: 'POST',
        body: String(error),
      }).catch(() => {})
    })
  }, [])

  const fixture = scene
    ? fixtures[`${scene.library}/${scene.kind}/${scene.count}`]
    : null
  const Cell = fixture?.Cell
  const Scope = fixture?.Scope
  return (
    <View style={{ flex: 1, paddingTop: 60 }}>
      <Text>{status}</Text>
      {scene && Cell && Scope ? (
        <Scope active={scene.active}>
          <View
            key={scene.key}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            {Array.from({ length: scene.count }, (_, index) => (
              <Cell
                key={index}
                index={index}
                active={scene.active}
                onLayout={(event) => {
                  const current = pending.current
                  if (!current || current.scene.key !== scene.key) return
                  const { kind, active } = current.scene
                  const width =
                    kind === 'theme'
                      ? 24
                      : kind === 'dynamic' || kind === 'variants'
                        ? active
                          ? 24
                          : 12
                        : 12 + (kind === 'unique' ? index % 13 : 0)
                  const height = kind === 'theme' ? (active ? 12 : 4) : 4
                  const layout = event.nativeEvent.layout
                  // Native layout rounds both edges to physical pixels relative to the root.
                  const density = PixelRatio.get()
                  if (
                    (
                      [
                        [layout.width, width],
                        [layout.height, height],
                      ] as const
                    ).some(([actual, expected]) => {
                      const pixels = actual * density
                      return (
                        !Number.isFinite(pixels) ||
                        pixels < Math.floor(expected * density) - 0.001 ||
                        pixels > Math.ceil(expected * density) + 0.001
                      )
                    })
                  ) {
                    current.reject(
                      new Error(
                        `Layout mismatch ${current.scene.library}/${kind}/${index}: ${JSON.stringify(layout)}, expected ${width}x${height}`,
                      ),
                    )
                    return
                  }
                  current.seen.add(index)
                  if (current.seen.size === current.scene.count)
                    current.resolve(performance.now() - current.start)
                }}
              />
            ))}
          </View>
        </Scope>
      ) : null}
    </View>
  )
}
