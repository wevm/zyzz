import { Vars } from 'zyzz'
/** Measures native table compilation and identity-preserving selection. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { bench, describe } from 'vite-plus/test'
import { Style } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'

const base = Vars.define({
  color: { ink: { dark: '#fff', light: '#000' } },
  spacing: { md: '1rem' },
})
const alternate = Vars.extend(base, { spacing: { md: '2rem' } })
const styles = Style.define(
  Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => [
      `card${index}`,
      { color: base.color.ink, padding: base.spacing.md },
    ]),
  ),
)
const options = { styles, vars: { alternate, base }, units: { rem: 16 } }
const output = StyleSheet.compile(options)

describe('native tables / 100 styles / 2 vars / 2 schemes', () => {
  bench(
    'compile',
    () => {
      StyleSheet.compile(options)
    },
    {
      iterations: 30,
      setup: async () => {
        const directory = Path.resolve('bench/results/native')
        await Fs.mkdir(directory, { recursive: true })
        await Fs.writeFile(
          Path.join(directory, 'tables.json'),
          JSON.stringify(
            {
              entries: 400,
              jsonBytes: Buffer.byteLength(JSON.stringify(output.styles)),
              uniqueStyles: new Set(
                Object.values(output.styles).flatMap((set) =>
                  Object.values(set).flatMap(Object.values),
                ),
              ).size,
            },
            null,
            2,
          ),
        )
      },
      time: 1000,
      warmupIterations: 10,
      warmupTime: 500,
    },
  )
  bench(
    'select',
    () => {
      StyleSheet.select(output.styles, {
        colorScheme: 'dark',
        set: 'alternate',
      })
    },
    { time: 1000, warmupTime: 500 },
  )
})

describe('native composition / compiled table and local override', () => {
  const style = output.styles.base.light.card0!
  const override = { opacity: 0.5 }
  bench(
    'compose and flatten',
    () => {
      StyleSheet.flatten(StyleSheet.compose(style, override))
    },
    { time: 1000, warmupTime: 500 },
  )
})
