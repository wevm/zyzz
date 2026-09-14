/**
 * Compiles shared literal workloads through real styling-library adapters.
 * @module
 */
import * as Babel from '@babel/core'
import * as Panda from '@pandacss/node'
import StylexPlugin, {
  type Rule,
  type StyleXTransformObj,
} from '@stylexjs/babel-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin'
import * as Esbuild from 'esbuild'
import * as LightningCss from 'lightningcss'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Tailwind from 'tailwindcss'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import * as Corpus from './Corpus.js'

/** CSS and the browser bundle that supplies every component's class names. */
export type Bundle = {
  /** Minified emitted stylesheet, with no source maps or reset. */
  css: string
  /** Minified client bundle including required runtime helpers. */
  javascript: string
}

/** Ordered compiler adapters, with no synthetic replacements or runtime injection lanes. */
export const compilers = {
  panda,
  stylex,
  tailwind,
  'vanilla-extract': vanillaExtract,
  zyzz,
}

/** Writes real compiler inputs from a shared deterministic literal workload. */
export async function create(
  workload: Corpus.Case,
  options: create.Options = {},
): Promise<Fixture> {
  const directory = await Fs.mkdtemp(Path.resolve('.fixture-compilation-'))

  // Package-relative file identities must not depend on the random temporary root.
  await Fs.writeFile(
    Path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'benchmark-fixture',
      private: true,
      type: 'module',
    }),
  )

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

  return {
    count: workload.count,
    directory,
    stylex: `import * as stylex from '@stylexjs/stylex';
      const styles = stylex.create(${JSON.stringify(Object.fromEntries(styles.map((style, index) => [names[index], style])))});
      export const classes = [${names.map((name) => `stylex.props(styles.${name}).className`).join(',')}];`,
    tailwind: styles.map((style) =>
      Object.entries<unknown>(style)
        .map(([key, value]) => {
          if (typeof value !== 'string' && typeof value !== 'number')
            throw new Error('Comparison fixtures require scalar values.')

          return `[${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}]`
        })
        .join(' '),
    ),
    targets: Object.freeze({ ...(options.targets ?? minification.targets) }),
    workload,
    zyzz: Style.define(
      Object.fromEntries(styles.map((style, index) => [names[index]!, style])),
    ),
  }
}

/** Shared CSS processing configuration for a complete literal comparison. */
export declare namespace create {
  /** Optional targets. Omitted values use the reproducible literal baseline. */
  type Options = minify.Options
}

/** Prepared equivalent inputs. Preparation is outside measured compilation. */
export type Fixture = {
  /** Number of authored components. */
  count: number
  /** Real temporary source directory. */
  directory: string
  /** Literal StyleX source. */
  stylex: string
  /** Tailwind candidates, including repeated uses. */
  tailwind: readonly string[]
  /** Immutable CSS targets shared by every adapter in this fixture. */
  readonly targets: Readonly<LightningCss.Targets>
  /** Workload metadata and the browser reference input. */
  workload: Corpus.Case
  /** Validated literal data. Definition preparation is outside compilation timing. */
  zyzz: Style.Definition
}

/** Bundles actual browser exports and their required runtime dependencies. */
export async function javascript(source: string): Promise<string> {
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

/** Fixed benchmark processing settings. These are not package support requirements. */
export const minification = {
  filename: 'styles.css',
  minify: true,
  sourceMap: false,
  targets: { chrome: 120 << 16, firefox: 128 << 16, safari: 17 << 16 },
}

/** Applies the same final CSS processing to every compiler's emitted stylesheet. */
export function minify(css: string, options: minify.Options = {}): string {
  return Buffer.from(
    LightningCss.transform({
      ...minification,
      code: Buffer.from(css),
      targets: options.targets ?? minification.targets,
    }).code,
  ).toString()
}

/** Explicit final-processing targets shared by each comparison workload. */
export declare namespace minify {
  /** Defaults to the existing literal browser baseline. */
  type Options = {
    /** Browser feature targets for the complete matched comparison. */
    readonly targets?: LightningCss.Targets | undefined
  }
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
    css: minify(await Fs.readFile(file, 'utf8'), { targets: fixture.targets }),
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

  // The package exports a CommonJS function. Its declaration uses an ESM default.
  const plugin = StylexPlugin as unknown as StyleXTransformObj

  return {
    css: minify(plugin.processStylexRules(metadata.stylex), {
      targets: fixture.targets,
    }),
    javascript: await javascript(result.code),
  }
}

/** Builds Tailwind utilities from prepared candidates, excluding content scanning. */
export async function tailwind(fixture: Fixture): Promise<Bundle> {
  const compiler = await Tailwind.compile('@tailwind utilities;')

  return {
    css: minify(
      compiler.build(fixture.tailwind.flatMap((value) => value.split(' '))),
      { targets: fixture.targets },
    ),
    javascript: await javascript(
      `export const classes = ${JSON.stringify(fixture.tailwind)};`,
    ),
  }
}

/** Runs vanilla-extract's official esbuild integration with fresh compiler state. */
export async function vanillaExtract(fixture: Fixture): Promise<Bundle> {
  const result = await Esbuild.build({
    absWorkingDir: fixture.directory,
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

  return { css: minify(css, { targets: fixture.targets }), javascript }
}

/** Compiles independent component applications and bundles their static class exports. */
export async function zyzz(fixture: Fixture): Promise<Bundle> {
  const output = Css.compile({
    cssOutput: 'grouped',
    composition: 'independent',
    styles: fixture.zyzz,
  })

  return {
    css: minify(output.css, { targets: fixture.targets }),
    javascript: await javascript(
      `export const classes = ${JSON.stringify(fixture.zyzz.styles.map(({ name }) => output.classes[name]))};`,
    ),
  }
}
