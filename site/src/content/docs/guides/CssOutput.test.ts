/** Compiles the CSS Output guide's examples and verifies each documented output. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Babel from '@babel/core'
import * as Panda from '@pandacss/dev/node'
import StylexPlugin from '@stylexjs/babel-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import * as Tailwind from 'tailwindcss'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const source = Fs.readFileSync(
  new URL('./css-output.mdx', import.meta.url),
  'utf8',
)
const root = Fs.realpathSync(new URL('../../../../..', import.meta.url))

const modules = Object.fromEntries(
  [...source.matchAll(/```tsx? title="([^"\n]+)"\n([\s\S]*?)```/g)].map(
    (match) => [match[1]!, match[2]!],
  ),
)

/** Reads the fenced code with a title, or the first fence of a language under a library heading. */
function fence(options: {
  language: string
  section?: string
  title?: string
}) {
  const scope = options.section
    ? source.split(`\n### ${options.section}\n`)[1]!.split('\n### ')[0]!
    : source
  const meta = options.title ? ` title="${options.title}"` : ''

  return scope.match(
    new RegExp('```' + options.language + meta + '\\n([\\s\\S]*?)```'),
  )![1]!
}

/** Lists leaf rules and layer statements without comments, whitespace, or final semicolons. */
function rules(css: string): readonly string[] {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, '')
      .replaceAll(';}', '}')
      .match(/[^{};]+\{[^{}]*\}|@layer[^{;]+;/g) ?? []
  )
}

describe('CSS Output examples', () => {
  test('compiles and renders the authored card in both modes', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped']) {
        const output = Graph.compile({
          modules: {
            ...modules,
            'zyzz.config.ts': modules['zyzz.config.ts']!.replace(
              "'grouped'",
              `'${cssOutput}'`,
            ),
          },
        })
        const card = output.modules['Card.tsx']!
        const classes = Object.values(card.classes)

        await page.setContent(
          `<style>${card.css}</style><article class="${classes[0]}"><span class="${classes[1]}">Account</span></article>`,
        )

        expect(
          await page
            .locator('article')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        expect(
          await page
            .locator('article')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"8px"')
        expect(
          await page
            .locator('span')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        expect(rules(card.css), cssOutput).toEqual(
          rules(fence({ language: 'css', title: `${cssOutput}.css` })),
        )
        expect(
          output.modules['CompactCard.tsx']!.css.includes('padding:4px;'),
        ).toMatchInlineSnapshot('true')
        expect(
          output.modules['CompactCard.tsx']!.code.includes('zyzz/runtime'),
        ).toMatchInlineSnapshot('true')
      }
    } finally {
      await browser.close()
    }
  })

  test("matches each library's documented output", async () => {
    const directory = Fs.mkdtempSync(Path.join(root, '.fixture-css-output-'))
    const documented = (section: string) =>
      rules(fence({ language: 'css', section }))
    try {
      Fs.mkdirSync(Path.join(directory, 'src'))
      Fs.writeFileSync(
        Path.join(directory, 'package.json'),
        JSON.stringify({ name: 'sample', private: true, type: 'module' }),
      )

      const tailwind = await Tailwind.compile('@tailwind utilities;')
      const candidates = Array.from(
        fence({ language: 'tsx', section: 'Tailwind CSS' }).matchAll(
          /className="([^"]+)"/g,
        ),
        (match) => match[1]!.split(' '),
      ).flat()

      expect(documented('Tailwind CSS')).toEqual(
        rules(tailwind.build(candidates)),
      )

      Fs.writeFileSync(
        Path.join(directory, 'panda.config.ts'),
        `export default { include: ['./src/**/*.tsx'], outdir: 'styled-system', preflight: false, presets: ['@pandacss/preset-base'], theme: {} }`,
      )
      Fs.writeFileSync(
        Path.join(directory, 'src/Card.tsx'),
        fence({ language: 'tsx', section: 'Panda CSS' }),
      )
      const driver = await Panda.createNodeDriver({ cwd: directory })
      driver.codegen()
      driver.parseFiles()
      driver.writeCss({
        cwd: directory,
        outfile: Path.join(directory, 'panda.css'),
      })
      const panda = rules(
        Fs.readFileSync(Path.join(directory, 'panda.css'), 'utf8'),
      )

      // The documented Panda output is abridged, so each documented rule must appear in the output.
      expect(
        documented('Panda CSS').filter((rule) => !panda.includes(rule)),
      ).toEqual([])

      Fs.writeFileSync(
        Path.join(directory, 'styles.css.ts'),
        fence({ language: 'ts', section: 'vanilla-extract' }),
      )
      const vanillaExtract = await Esbuild.build({
        absWorkingDir: directory,
        bundle: true,
        entryPoints: [Path.join(directory, 'styles.css.ts')],
        format: 'esm',
        outfile: Path.join(directory, 'out.js'),
        plugins: [vanillaExtractPlugin({ identifiers: 'short' })],
        write: false,
      })

      expect(documented('vanilla-extract')).toEqual(
        rules(
          vanillaExtract.outputFiles.find((file) => file.path.endsWith('.css'))!
            .text,
        ),
      )

      const stylex = Babel.transformSync(
        fence({ language: 'tsx', section: 'StyleX' }),
        {
          babelrc: false,
          configFile: false,
          filename: Path.join(directory, 'Card.tsx'),
          parserOpts: { plugins: ['jsx', 'typescript'] },
          plugins: [[StylexPlugin, { dev: false, runtimeInjection: false }]],
        },
      )
      const metadata = stylex?.metadata as { stylex?: unknown } | undefined
      // The package exports a CommonJS function whose declaration uses an ESM default.
      const plugin = StylexPlugin as unknown as {
        processStylexRules(rules: unknown): string
      }

      expect(documented('StyleX')).toEqual(
        rules(plugin.processStylexRules(metadata?.stylex)),
      )
    } finally {
      Fs.rmSync(directory, { recursive: true, force: true })
    }
  }, 60000)
})
