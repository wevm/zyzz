/** Compiles native fixtures before Metro bundles the application. @module */
import * as Fs from 'node:fs/promises'
import { Native } from 'zyzz/compiler'

const source = await Fs.readFile(
  new URL('./Styles.ts', import.meta.url),
  'utf8',
)
await Fs.mkdir(new URL('./generated/', import.meta.url), { recursive: true })

for (const platform of ['android', 'ios'] as const) {
  const output = Native.compile({
    colorScheme: 'light',
    moduleId: 'Styles.ts',
    platform,
    source,
    units: { px: 1 },
  })

  await Fs.writeFile(
    new URL(`./generated/${platform}.ts`, import.meta.url),
    output.code,
  )
}
