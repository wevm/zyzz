/** Exercises configured output through linked source compilation and execution. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('create', () => {
  test('links HTML output across configuration imports and compiles callable bindings', async () => {
    const result = Graph.compile({
      modules: {
        'config.ts': `import { Config } from 'zyzz'; export const { css } = Config.create({ output: 'html' });`,
        'card.ts': `import { css } from './config.js';
const styles = { card: css({ padding: '8px' }), dynamic: css((values: { width: \`\${number}%\` }) => ({ width: values.width })) };
export const plain = styles.card();
export const overridden = styles.card({ className: 'external', style: { marginTop: '12px' } });
export const dynamic = styles.dynamic({ width: '25%', style: { opacity: 0.5 } });`,
      },
    })

    const bundle = await Esbuild.build({
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      stdin: {
        contents: result.modules['card.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      write: false,
    })

    const values = Vm.runInNewContext(
      `${bundle.outputFiles[0]!.text}; Fixture;`,
    ) as {
      plain: { class: string; className?: string }
      overridden: { class: string; style: string }
      dynamic: { class: string; style: string }
    }

    expect(typeof values.plain.class).toMatchInlineSnapshot('"string"')
    expect(values.plain.className).toMatchInlineSnapshot('undefined')
    expect(values.overridden.class.endsWith(' external')).toMatchInlineSnapshot(
      'true',
    )
    expect(values.overridden.style).toMatchInlineSnapshot('"margin-top:12px"')
    expect(values.dynamic.style.includes(':25%')).toMatchInlineSnapshot('true')
    expect(
      values.dynamic.style.startsWith('opacity:0.5;'),
    ).toMatchInlineSnapshot('true')
  })
})
