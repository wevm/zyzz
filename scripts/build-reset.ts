/** Embeds the canonical reset for filesystem-free compiler use. @module */
import * as Fs from 'node:fs/promises'

const css = await Fs.readFile(
  new URL('../src/reset.css', import.meta.url),
  'utf8',
)
await Fs.writeFile(
  new URL('../src/compiler/internal/ResetCss.ts', import.meta.url),
  `/** Generated from src/reset.css by scripts/build-reset.ts. @module */\n/** Canonical opt-in web reset. */\nexport const css = ${JSON.stringify(css)}\n`,
)
