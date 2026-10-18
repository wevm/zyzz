/** Checks the Base UI guide's examples through public types and filesystem compilation. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

describe('Base UI guide', () => {
  test('type-checks and compiles the documented parts and configured states', async () => {
    const project = Path.resolve(import.meta.dirname, '../../../../..')
    const document = await Fs.readFile(
      new URL('./base-ui.mdx', import.meta.url),
      'utf8',
    )
    const examples = Array.from(
      document.matchAll(/```tsx? title="([^"]+)"\n([\s\S]*?)```/g),
    )
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-base-ui-guide-'))

    try {
      await Fs.mkdir(Path.join(root, 'node_modules'))
      await Fs.symlink(project, Path.join(root, 'node_modules/zyzz'), 'dir')

      const files: string[] = []
      for (const example of examples) {
        const file = Path.join(root, example[1]!)
        await Fs.writeFile(file, example[2]!)
        files.push(file)
      }

      const config = Ts.readConfigFile(
        Path.join(project, 'tsconfig.json'),
        Ts.sys.readFile,
      )
      const parsed = Ts.parseJsonConfigFileContent(
        config.config,
        Ts.sys,
        project,
      )
      const program = Ts.createProgram(files, {
        ...parsed.options,
        types: ['node'],
      })
      const diagnostics = [
        ...program.getOptionsDiagnostics(),
        ...files.flatMap((file) => {
          const source = program.getSourceFile(file)!
          return [
            ...program.getSyntacticDiagnostics(source),
            ...program.getSemanticDiagnostics(source),
          ]
        }),
      ]

      expect(
        diagnostics.map((diagnostic) =>
          Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
      ).toMatchInlineSnapshot('[]')
      expect(examples.length).toMatchInlineSnapshot('7')

      const outDir = Path.join(root, 'dist')
      await using host = await Host.create({
        css: false,
        outDir,
        packageId: 'base-ui-guide',
        root,
      })
      await host.build()

      const css = (
        await Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
      ).replace(/\s+/g, '')

      expect(css.match(/\[data-[^\]]+\]\{[^}]*\}/g)).toMatchInlineSnapshot(`
        [
          "[data-checked]{background-color:blue;}",
          "[data-checked]{translate:16px;}",
          "[data-checked]{background-color:var(--z-default-color-blue-900,light-dark(#0068d6,#52a8ff));}",
          "[data-disabled]{cursor:not-allowed;}",
          "[data-disabled]{opacity:.5;}",
          "[data-checked]{translate:var(--z-default-spacing-4,1rem);}",
          "[data-highlighted]{background-color:#add8e6;}",
          "[data-pending]{opacity:.5;}",
          "[data-side="bottom"]{margin-top:4px;}",
          "[data-side="top"]{margin-bottom:4px;}",
        ]
      `)
      expect(
        css.includes('max-height:var(--available-height)'),
      ).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  }, 60_000)
})
