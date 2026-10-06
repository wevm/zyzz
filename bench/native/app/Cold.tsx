/** Mounts one benchmark lane in a fresh process and reports time to its first native layout. @module */
import { View } from 'react-native'
import { fixtures } from './generated/index.js'

/** React Native's startup marks, which the DOM `Performance` type omits. */
type Startup = Performance & {
  readonly rnStartupTiming: {
    readonly executeJavaScriptBundleEntryPointStart: number
  }
}

/**
 * Loads only the selected lane, including Unistyles configuration for its own lanes.
 * @param lane - Fixture key such as `zyzz/theme/1000`.
 * @returns The root component to register.
 */
export function create(lane: string) {
  const [library, , count] = lane.split('/')
  if (library === 'unistyles') require('./Setup.js')
  const fixture = fixtures[lane as keyof typeof fixtures]()
  const seen = new Set<number>()
  return function Cold() {
    return (
      <View style={{ flex: 1, paddingTop: 60 }}>
        <fixture.Scope active={false} onTheme={() => {}}>
          <View
            style={{
              alignItems: 'flex-start',
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            {Array.from({ length: Number(count) }, (_, index) => (
              <fixture.Cell
                active={false}
                index={index}
                key={index}
                onLayout={() => {
                  seen.add(index)
                  if (seen.size !== Number(count)) return
                  const start = (performance as Startup).rnStartupTiming
                    .executeJavaScriptBundleEntryPointStart
                  void fetch('http://localhost:8765/cold', {
                    body: JSON.stringify({
                      lane,
                      milliseconds: performance.now() - start,
                    }),
                    method: 'POST',
                  })
                }}
              />
            ))}
          </View>
        </fixture.Scope>
      </View>
    )
  }
}
