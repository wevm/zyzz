import * as Babel from '@babel/core'
import * as Panda from '@pandacss/node'
import StylexPlugin, {
  type Rule,
  type StyleXTransformObj,
} from '@stylexjs/babel-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import { promisify } from 'node:util'
import * as Path from 'node:path'
import * as Tailwind from 'tailwindcss'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import * as Corpus from './Corpus.js'

/** CSS and the browser bundle that supplies every component's class names. */
export type Bundle = {
  /** Minified emitted stylesheet; no source maps or reset. */
  css: string
  /** Minified client bundle including required runtime helpers. */
  javascript: string
}

/** Ordered compiler adapters; no synthetic replacements or runtime injection lanes. */
export const compilers = {
  panda,
  stylex,
  tailwind,
  tamagui,
  'vanilla-extract': vanillaExtract,
  zyzz,
}

/** Writes real compiler inputs from a shared deterministic literal workload. */
export async function create(workload: Corpus.Case): Promise<Fixture> {
  const directory = await Fs.mkdtemp(Path.resolve('.fixture-compilation-'))
  const styles = Corpus.styles(workload)
  const names = styles.map((_, index) => `card${index}`)
  await Fs.writeFile(
    Path.join(directory, 'styles.css.ts'),
    `import { style } from '@vanilla-extract/css';\n${styles
      .map(
        (style, index) =>
          `const ${names[index]} = style(${JSON.stringify(style)});`,
      )
      .join('\n')}\nexport const classes = [${names.join(',')}];`,
  )
  await Fs.writeFile(
    Path.join(directory, 'panda.config.ts'),
    `export default { include: ['./panda.ts'], outdir: 'styled-system', preflight: false, presets: ['@pandacss/preset-base'], theme: {} }`,
  )
  await Fs.writeFile(
    Path.join(directory, 'panda.ts'),
    `import { css } from './styled-system/css'; export const classes = [${styles.map((style) => `css(${JSON.stringify(style)})`).join(',')}];`,
  )
  await Fs.writeFile(
    Path.join(directory, 'tamagui.config.ts'),
    `import { createTamagui } from '@tamagui/core'; export default createTamagui({ tokens: {color:{},radius:{},size:{true:0},space:{true:0},zIndex:{}}, themes: {light:{}}, fonts:{} });`,
  )
  return {
    count: workload.count,
    directory,
    stylex: `import * as stylex from '@stylexjs/stylex';
      const styles = stylex.create(${JSON.stringify(Object.fromEntries(styles.map((style, index) => [names[index], style])))});
      export const classes = [${names.map((name) => `stylex.props(styles.${name}).className`).join(',')}];`,
    tailwind: styles.map((style) =>
      Object.entries(style)
        .map(
          ([key, value]) =>
            `[${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}]`,
        )
        .join(' '),
    ),
    tamagui: `import { View } from '@tamagui/core';
      ${styles
        .map(
          (style, index) =>
            `const Card${index} = () => <View ${Object.entries({
              alignItems: 'normal',
              boxSizing: 'content-box',
              display: 'block',
              flexDirection: 'row',
              flexShrink: 1,
              minHeight: 'auto',
              minWidth: 'auto',
              ...style,
            })
              .map(
                ([property, value]) =>
                  `${property}={${JSON.stringify(property === 'lineHeight' && typeof value === 'number' ? String(value) : value)}}`,
              )
              .join(' ')} />;`,
        )
        .join('\n')}
      export const classes = [${styles.map((_, index) => `Card${index}().props.className`).join(',')}];`,
    workload,
    zyzz: Style.define(
      Object.fromEntries(styles.map((style, index) => [names[index]!, style])),
    ),
  }
}

/** Prepared equivalent inputs; preparation is outside measured compilation. */
export type Fixture = {
  /** Number of authored components. */
  count: number
  /** Real temporary source directory. */
  directory: string
  /** Literal StyleX source. */
  stylex: string
  /** Tailwind candidates, including repeated uses. */
  tailwind: readonly string[]
  /** Literal JSX source for Tamagui's real static extractor. */
  tamagui: string
  /** Workload metadata and the browser reference input. */
  workload: Corpus.Case
  /** Validated literal data; definition preparation is outside compilation timing. */
  zyzz: Style.Definition
}

async function javascript(source: string): Promise<string> {
  const result = await Esbuild.build({
    bundle: true,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    format: 'iife',
    globalName: 'fixture',
    jsx: 'automatic',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    stdin: {
      contents: source,
      loader: 'tsx',
      resolveDir: process.cwd(),
      sourcefile: 'fixture.ts',
    },
    write: false,
  })
  return result.outputFiles[0]!.text
}

async function minify(css: string): Promise<string> {
  return (
    await Esbuild.transform(css, {
      legalComments: 'none',
      loader: 'css',
      minify: true,
    })
  ).code
}

/** Runs Panda's config loading, code generation, extraction, and browser bundling. */
export async function panda(fixture: Fixture): Promise<Bundle> {
  const context = await Panda.loadConfigAndCreateContext({
    cwd: fixture.directory,
  })
  await Panda.codegen(context)
  const file = Path.join(fixture.directory, 'panda.css')
  await Panda.cssgen(context, { cwd: fixture.directory, outfile: file })
  return {
    css: await minify(await Fs.readFile(file, 'utf8')),
    javascript: await javascript(
      `export { classes } from ${JSON.stringify(Path.join(fixture.directory, 'panda.ts'))};`,
    ),
  }
}

/** Runs Babel extraction, StyleX rule processing, and a real browser bundle. */
export async function stylex(fixture: Fixture): Promise<Bundle> {
  const result = Babel.transformSync(fixture.stylex, {
    babelrc: false,
    configFile: false,
    filename: Path.join(fixture.directory, 'styles.ts'),
    plugins: [[StylexPlugin, { dev: false, runtimeInjection: false }]],
  })
  const metadata = result?.metadata as { stylex?: Rule[] } | undefined
  if (!result?.code || !metadata?.stylex?.length)
    throw new Error('StyleX did not emit a module and CSS rules.')
  // The package exports a CommonJS function; its declaration uses an ESM default.
  const plugin = StylexPlugin as unknown as StyleXTransformObj
  return {
    css: await minify(plugin.processStylexRules(metadata.stylex)),
    javascript: await javascript(result.code),
  }
}

/** Builds Tailwind utilities from prepared candidates; excludes content scanning. */
export async function tailwind(fixture: Fixture): Promise<Bundle> {
  const compiler = await Tailwind.compile('@tailwind utilities;')
  return {
    css: await minify(
      compiler.build(fixture.tailwind.flatMap((value) => value.split(' '))),
    ),
    javascript: await javascript(
      `export const classes = ${JSON.stringify(fixture.tailwind)};`,
    ),
  }
}

/** Runs Tamagui's JSX extractor and bundles its actual compiled class references. */
export async function tamagui(fixture: Fixture): Promise<Bundle> {
  await Fs.writeFile(
    Path.join(fixture.directory, 'tamagui.tsx'),
    fixture.tamagui,
  )
  await promisify(ChildProcess.execFile)(
    process.execPath,
    [
      Path.resolve('bench/Tamagui.ts'),
      fixture.directory,
      String(fixture.count),
    ],
    {
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 60_000,
    },
  )
  return {
    css: await minify(
      await Fs.readFile(Path.join(fixture.directory, 'tamagui.css'), 'utf8'),
    ),
    javascript: await javascript(
      await Fs.readFile(
        Path.join(fixture.directory, 'tamagui-output.tsx'),
        'utf8',
      ),
    ),
  }
}

/** Runs vanilla-extract's official esbuild integration with fresh compiler state. */
export async function vanillaExtract(fixture: Fixture): Promise<Bundle> {
  const result = await Esbuild.build({
    bundle: true,
    entryPoints: [Path.join(fixture.directory, 'styles.css.ts')],
    format: 'iife',
    globalName: 'fixture',
    legalComments: 'none',
    minify: true,
    outfile: Path.join(fixture.directory, 'out.js'),
    plugins: [vanillaExtractPlugin({ identifiers: 'short' })],
    write: false,
  })
  const css = result.outputFiles.find((file) =>
    file.path.endsWith('.css'),
  )?.text
  const javascript = result.outputFiles.find((file) =>
    file.path.endsWith('.js'),
  )?.text
  if (!css || !javascript)
    throw new Error('vanilla-extract did not emit CSS and JavaScript.')
  return { css: await minify(css), javascript }
}

/** Emits grouped CSS from prepared definitions and bundles static class exports. */
export async function zyzz(fixture: Fixture): Promise<Bundle> {
  const output = Css.compile({ styles: fixture.zyzz })
  return {
    css: await minify(output.css),
    javascript: await javascript(
      `export const classes = ${JSON.stringify(fixture.zyzz.styles.map(({ name }) => output.classes[name]))};`,
    ),
  }
}
