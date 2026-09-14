/** Measures actual generated React and HTML composition callables over fixed CSS. @module */
import * as Esbuild from 'esbuild'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

for (const output of ['react', 'html'] as const) {
  const source = `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'${output}'});namespace styles{export const value=css((values:{padding:\`\${number}px\`})=>({padding:values.padding}));export const fixed=css({paddingLeft:'3px'})}export const apply=(enabled:boolean,padding:\`\${number}px\`)=>cx(styles.value({padding}),enabled && styles.fixed());`
  const options = { moduleId: 'compose.ts', source }
  const compiled = Transform.compile({ ...options, cssOutput: 'grouped' })
  const bundled = await Esbuild.build({
    stdin: { contents: compiled.code, loader: 'ts', resolveDir: process.cwd() },
    alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
    bundle: true,
    format: 'esm',
    write: false,
  })
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(bundled.outputFiles![0]!.text).toString('base64')}`
  )) as { apply: (enabled: boolean, padding: `${number}px`) => unknown }

  describe(`cx / ${output} runtime composition`, () => {
    bench('compile conditional groups', () => {
      Transform.compile({ ...options, cssOutput: 'grouped' })
    })
    bench('select and bind both arguments', () => {
      module.apply(true, '16px')
    })
    bench('remove conditional argument', () => {
      module.apply(false, '12px')
    })
  })
}
