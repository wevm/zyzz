import Tamagui from '@tamagui/static'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

// Tamagui installs evaluation hooks; keep them outside the benchmark runner.
const directory = process.argv[2]
if (!directory)
  throw new Error('Expected a prepared Tamagui fixture directory.')
const extractor = Tamagui.createExtractor({ platform: 'web' })
try {
  const result = await Tamagui.extractToClassNames({
    extractor,
    options: {
      components: ['@tamagui/core'],
      config: Path.join(directory, 'tamagui.config.ts'),
      logTimings: false,
      platform: 'web',
    },
    shouldPrintDebug: false,
    source: await Fs.readFile(Path.join(directory, 'tamagui.tsx'), 'utf8'),
    sourcePath: Path.join(directory, 'tamagui.tsx'),
  })
  if (!result?.styles || result.stats.flattened !== Number(process.argv[3]))
    throw new Error(
      'Tamagui did not statically flatten every fixture component.',
    )
  await Fs.writeFile(Path.join(directory, 'tamagui.css'), result.styles)
  await Fs.writeFile(Path.join(directory, 'tamagui-output.tsx'), result.js)
} finally {
  extractor.cleanupBeforeExit()
}
