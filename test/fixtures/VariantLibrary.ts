/** Builds an actual packed variant library with independent declaration and runtime consumers. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { Graph } from 'zyzz/compiler'

/** Shared publisher sources, including bound factories and renamed namespace exports. */
export function sources(options: sources.Options = {}) {
  const { cssOutput, output = 'react' } = options
  return {
    '@acme/variants/config.ts': `import {Config} from 'zyzz';
export const {style,variants,theme}=Config.create({${cssOutput ? `cssOutput:'${cssOutput}',` : ''}${output === 'html' ? "output:'html'," : ''}theme:{color:{brand:{light:'#0066cc',dark:'#99ccff'}},breakpoints:{wide:'600px'}},shorthands:{px:['paddingLeft','paddingRight']}});`,
    '@acme/variants/styles.ts': `import {style,variants} from './config.js';
export namespace styles {
  export const button=variants({
    base:{color:'brand',padding:'2px'},
    conditions:{wide:'@media >=wide'},
    variants:{size:{sm:{px:'4px'},lg:{px:'12px'},custom:(values:{padding:\`\${number}px\`})=>({px:values.padding})},active:{true:{opacity:1},false:{opacity:0.5}}},
    defaultVariants:{size:'sm',active:false},
    compoundVariants:[{when:{size:['lg','custom'],active:true},style:{borderWidth:'3px',borderStyle:'solid'}}]
  });
  export const override=style({paddingLeft:'3px'});
}`,
    '@acme/variants/index.ts': `export {style,variants as variant,theme} from './config.js';
export {styles as controls} from './styles.js';`,
  }
}

/** Publisher representation settings. */
export declare namespace sources {
  /** Independent CSS and renderer output settings. */
  type Options = {
    /** CSS representation. */
    cssOutput?: 'atomic' | 'grouped' | undefined
    /** Renderer props shape. */
    output?: 'html' | 'react' | undefined
  }
}

/** Packs all finite alternatives and compiler metadata into a source-free npm archive. */
export async function create(root: string, options: sources.Options = {}) {
  const directory = Path.join(root, 'publisher')
  await Fs.mkdir(directory, { recursive: true })
  const inputs = sources(options)
  const compiled = Graph.compile({ modules: inputs })
  await Fs.mkdir(Path.join(root, 'node_modules'), { recursive: true })
  const exec = Util.promisify(ChildProcess.execFile)
  if (
    !(await Fs.access(Path.join(root, 'node_modules/zyzz/package.json')).then(
      () => true,
      () => false,
    ))
  ) {
    const runtimePack = await exec(
      'pnpm',
      ['pack', '--json', '--pack-destination', root],
      { cwd: process.cwd() },
    )
    const runtimeArchive = JSON.parse(runtimePack.stdout) as {
      filename: string
    }
    await Fs.mkdir(Path.join(root, 'node_modules/zyzz'))
    await exec('tar', [
      '-xf',
      runtimeArchive.filename,
      '-C',
      Path.join(root, 'node_modules/zyzz'),
      '--strip-components=1',
    ])
  }
  for (const [id, module] of Object.entries(compiled.modules)) {
    const file = Path.basename(id, '.ts')
    const transformed = await Esbuild.transform(
      `${module.code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(module.map)).toString('base64')}`,
      {
        format: 'esm',
        loader: 'ts',
        sourcefile: id,
        sourcemap: 'external',
      },
    )
    await Fs.writeFile(
      Path.join(directory, `${file}.ts`),
      inputs[id as keyof typeof inputs],
    )
    await Fs.writeFile(
      Path.join(directory, `${file}.js`),
      `${transformed.code}\n//# sourceMappingURL=${file}.js.map`,
    )
    await Fs.writeFile(Path.join(directory, `${file}.js.map`), transformed.map)
    await Fs.writeFile(
      Path.join(directory, `${file}.js.zyzz.json`),
      compiled.contracts[id]!,
    )
    await Fs.writeFile(
      Path.join(directory, `${file}.css.map`),
      JSON.stringify(module.cssMap),
    )
  }
  await Fs.writeFile(
    Path.join(directory, 'style.css'),
    `${compiled.sharedCss ?? ''}\n${Object.values(compiled.modules)
      .map((module) => module.css)
      .join('\n')}`,
  )
  await Fs.writeFile(
    Path.join(directory, 'package.json'),
    JSON.stringify({
      exports: {
        '.': { types: './index.d.ts', default: './index.js' },
        './style.css': './style.css',
      },
      files: ['*.js', '*.d.ts', '*.json', '*.css', '*.map'],
      name: '@acme/variants',
      peerDependencies: { zyzz: '*' },
      sideEffects: ['*.css'],
      type: 'module',
      version: '1.0.0',
    }),
  )
  await exec(process.execPath, [
    Path.resolve('node_modules/typescript/bin/tsc'),
    '--ignoreConfig',
    '--module',
    'nodenext',
    '--target',
    'esnext',
    '--strict',
    '--skipLibCheck',
    '--declaration',
    '--emitDeclarationOnly',
    '--outDir',
    Path.join(directory, 'types'),
    ...Object.keys(inputs).map((id) => Path.join(directory, Path.basename(id))),
  ]).catch((error) => {
    throw new Error(error.stdout || error.message)
  })
  for (const id of Object.keys(inputs)) {
    const file = Path.basename(id, '.ts')
    await Fs.rename(
      Path.join(directory, 'types', `${file}.d.ts`),
      Path.join(directory, `${file}.d.ts`),
    )
    await Fs.rm(Path.join(directory, `${file}.ts`))
  }
  await Fs.rm(Path.join(directory, 'types'), { recursive: true })
  const packed = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--offline', '--json'],
    { cwd: directory },
  )
  const archive = (JSON.parse(packed.stdout) as { filename: string }[])[0]!
  const installed = Path.join(root, 'node_modules/@acme/variants')
  await Fs.mkdir(installed, { recursive: true })
  await exec('tar', [
    '-xf',
    Path.join(directory, archive.filename),
    '-C',
    installed,
    '--strip-components=1',
  ])
  return { compiled, directory, installed }
}
