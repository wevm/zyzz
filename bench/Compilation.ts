import * as Babel from '@babel/core'
import StylexPlugin, {
  type Rule,
  type StyleXTransformObj,
} from '@stylexjs/babel-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Tailwind from 'tailwindcss'

/** CSS and the browser bundle that supplies every component's class names. */
export type Bundle = {
  /** Minified emitted stylesheet; no source maps or reset. */
  css: string
  /** Minified client bundle including required runtime helpers. */
  javascript: string
}

/** Writes real compiler inputs for the same eight-declaration component corpus. */
export async function create(count: number, unique: boolean): Promise<Fixture> {
  const directory = await Fs.mkdtemp(Path.resolve('.fixture-compilation-'))
  const styles = Array.from({ length: count }, (_, index) => ({
    backgroundColor: '#fff',
    borderColor: '#000',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: '#000',
    display: 'block',
    padding: unique ? `${index}px` : '12px',
  }))
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
  return {
    count,
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
    unique,
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
  /** Whether each component has a distinct padding value. */
  unique: boolean
}

async function javascript(source: string): Promise<string> {
  const result = await Esbuild.build({
    bundle: true,
    format: 'iife',
    globalName: 'fixture',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    stdin: {
      contents: source,
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
