/** Verifies animation hook diagnostics on the native renderer. @module */
import * as React from 'react'
import { AppRegistry, PixelRatio, TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'
import { defineConfig } from 'zyzz/react-native/react'
import {
  useAnimatedStyleValue,
  useAnimatedVars,
} from 'zyzz/react-native/reanimated'
import type { Report as UpdatesReport } from './Updates.js'

const { Provider, vars } = defineConfig({ vars: { spacing: { gap: '8px' } } })
const errors = new Map<string, string>()
const bridge = TurboModuleRegistry.get<
  TurboModule & { inspect(): UpdatesReport['native'] }
>('NativeZyzz')
const cases = [
  'color',
  'cycle',
  'function',
  'instance',
  'missing',
  'nonfinite',
  'percentage',
  'symbol',
]

/** Diagnostics captured by native React error boundaries. */
export type Report = Omit<UpdatesReport, 'renders'> & {
  readonly errors: Readonly<Record<string, string>>
  readonly renders: Readonly<Record<string, number>>
}

class Boundary extends React.Component<
  Boundary.Props,
  { readonly failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error) {
    errors.set(this.props.id, error.message)
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

namespace Boundary {
  export type Props = {
    readonly children: React.ReactNode
    readonly id: string
  }
}

function Invalid(props: Invalid.Props) {
  if (props.id === 'provider') useAnimatedVars(vars)
  else if (props.id === 'missing') useAnimatedStyleValue({}, 'width')
  else if (props.id === 'nonfinite')
    useAnimatedStyleValue({ width: Infinity }, 'width')
  else if (props.id === 'percentage')
    useAnimatedStyleValue({ width: '50%' }, 'width')
  else if (props.id === 'color')
    useAnimatedStyleValue({ backgroundColor: 'invalid' }, 'backgroundColor')
  else {
    // @ts-expect-error Exercises invalid JavaScript selections on the native renderer.
    useAnimatedVars(vars, () => {
      if (props.id === 'function') return () => 1
      if (props.id === 'instance') return new Date()
      if (props.id === 'symbol') return { [Symbol('invalid')]: 1 }
      const cycle: { self?: unknown } = {}
      cycle.self = cycle
      return cycle
    })
  }
  return null
}

namespace Invalid {
  export type Props = { readonly id: string }
}

function App() {
  React.useEffect(() => {
    async function run() {
      const deadline = Date.now() + 5_000
      while (errors.size !== cases.length + 1 && Date.now() < deadline)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
      if (errors.size !== cases.length + 1 || !bridge)
        throw new Error('Native diagnostic cases did not complete.')
      await fetch('__REPORT_URL__', {
        body: JSON.stringify({
          errors: Object.fromEntries(errors),
          geometry: [],
          name: 'commit',
          native: bridge.inspect(),
          releases: 0,
          renders: {},
          scale: PixelRatio.get(),
        } satisfies Report),
        method: 'POST',
      })
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
    <>
      <Boundary id="provider">
        <Invalid id="provider" />
      </Boundary>
      <Provider colorScheme="light">
        {cases.map((id) => (
          <Boundary id={id} key={id}>
            <Invalid id={id} />
          </Boundary>
        ))}
      </Provider>
    </>
  )
}

AppRegistry.registerComponent('main', () => App)
