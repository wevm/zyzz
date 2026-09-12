/**
 * Compiles equivalent scoped-theme workloads through real styling-library APIs.
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
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Tailwind from 'tailwindcss'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'
import * as Compilation from './Compilation.js'

/** Matched compiler lanes; native APIs retain their required delivery artifacts. */
export const compilers = {
  panda,
  stylex,
  tailwind,
  'vanilla-extract': vanillaExtract,
  zyzz,
  'zyzz-tokens': zyzzTokens,
}

/** Prepares two complete themes and distinct widths outside compilation timing. */
export async function create(
  count: number,
  options: create.Options = {},
): Promise<Fixture> {
  const profile = Object.freeze({ ...(options.targets ?? targets) })
  // Lowering light-dark cannot observe external or inline color-scheme scopes.
  if (
    !Compilation.minify('.probe{color:light-dark(#fff,#000)}', {
      targets: profile,
    }).includes('light-dark(')
  )
    throw new Error(
      'Theme benchmarks require targets with native light-dark() support.',
    )

  const directory = await Fs.mkdtemp(Path.resolve('.fixture-themes-'))

  try {
    await Fs.writeFile(
      Path.join(directory, 'package.json'),
      JSON.stringify({
        name: 'theme-benchmark',
        private: true,
        type: 'module',
      }),
    )

    const base = {
      background: 'light-dark(#fff,#111)',
      foreground: 'light-dark(#111,#fff)',
      space: '8px',
    }

    const alternate = {
      background: 'light-dark(#eee,#222)',
      foreground: 'light-dark(#06c,#9cf)',
      space: '16px',
    }

    const indices = Array.from({ length: count }, (_, index) => index)

    const styles = (vars: string) =>
      indices
        .map(
          (index) =>
            `card${index}:{backgroundColor:${vars}.background,color:${vars}.foreground,padding:${vars}.space,width:'${index}px'}`,
        )
        .join(',')

    await Fs.writeFile(
      Path.join(directory, 'styles.css.ts'),
      `import {createThemeContract,createTheme,style} from '@vanilla-extract/css';
const vars=createThemeContract({background:null,foreground:null,space:null});
export const themes={alternate:{className:createTheme(vars,${JSON.stringify(alternate)})},base:{className:createTheme(vars,${JSON.stringify(base)})}};
const styles={${styles('vars')}};
export const classes=[${indices.map((index) => `style(styles.card${index})`).join(',')}];`,
    )
    await Fs.writeFile(
      Path.join(directory, 'tokens.stylex.ts'),
      `import * as stylex from '@stylexjs/stylex'; export const tokens=stylex.defineVars(${JSON.stringify(base)});`,
    )
    await Fs.writeFile(
      Path.join(directory, 'stylex.ts'),
      `import * as stylex from '@stylexjs/stylex'; import {tokens} from './tokens.stylex';
const alternate=stylex.createTheme(tokens,${JSON.stringify(alternate)});
const base=stylex.createTheme(tokens,${JSON.stringify(base)});
const styles=stylex.create({${styles('tokens')}});
export const classes=[${indices.map((index) => `stylex.props(styles.card${index}).className`).join(',')}];
export const themes={alternate:stylex.props(alternate),base:stylex.props(base)};`,
    )

    const pandaTheme = (values: typeof base) => ({
      semanticTokens: {
        colors: {
          background: { value: values.background },
          foreground: { value: values.foreground },
        },
        spacing: { card: { value: values.space } },
      },
    })

    await Fs.writeFile(
      Path.join(directory, 'panda.config.ts'),
      `export default ${JSON.stringify({ include: ['./panda.ts'], outdir: 'styled-system', preflight: false, presets: ['@pandacss/preset-base'], staticCss: { themes: ['*'] }, theme: pandaTheme(base), themes: { alternate: pandaTheme(alternate), base: pandaTheme(base) } })}`,
    )
    await Fs.writeFile(
      Path.join(directory, 'panda.ts'),
      `import {css} from './styled-system/css';
export const classes=[${indices.map((index) => `css({backgroundColor:'background',color:'foreground',padding:'card',width:'${index}px'})`).join(',')}];
export const themes={alternate:{'data-panda-theme':'alternate'},base:{'data-panda-theme':'base'}};`,
    )

    const theme = Theme.define({
      backgroundColor: { surface: { dark: '#111', light: '#fff' } },
      color: { foreground: { dark: '#fff', light: '#111' } },
      spacing: { card: '8px' },
    })

    return {
      count,
      directory,
      tailwind: indices.map(
        (index) => `bg-background text-foreground p-card w-[${index}px]`,
      ),
      tailwindCss: `@theme {--color-background:${base.background};--color-foreground:${base.foreground};--spacing-card:${base.space};}
@tailwind utilities;
.base{--color-background:${base.background};--color-foreground:${base.foreground};--spacing-card:${base.space};}
.alternate{--color-background:${alternate.background};--color-foreground:${alternate.foreground};--spacing-card:${alternate.space};}`,
      targets: profile,
      themes: {
        alternate: Theme.extend(theme, {
          backgroundColor: { surface: { dark: '#222', light: '#eee' } },
          color: { foreground: { dark: '#9cf', light: '#06c' } },
          spacing: { card: '16px' },
        }),
        base: theme,
      },
      zyzz: Style.define(
        Object.fromEntries(
          indices.map((index) => [
            `card${index}`,
            {
              backgroundColor: theme.tokens.backgroundColor.surface,
              color: theme.tokens.color.foreground,
              padding: theme.tokens.spacing.card,
              width: `${index}px` as const,
            },
          ]),
        ),
      ),
      zyzzTokens: Object.fromEntries(
        indices.map((index) => [
          `card${index}`,
          {
            backgroundColor: 'surface',
            color: 'foreground',
            padding: 'card',
            width: `${index}px` as const,
          },
        ]),
      ),
    }
  } catch (error) {
    await Fs.rm(directory, { force: true, recursive: true })
    throw error
  }
}

/** Shared CSS processing configuration for a complete theme comparison. */
export declare namespace create {
  /** Optional targets; omitted values use the native light-dark baseline. */
  type Options = Compilation.minify.Options
}

/** Inputs shared by timing, delivery measurement, and browser verification. */
export type Fixture = {
  /** Number of distinct component widths. */
  readonly count: number
  /** Real compiler input directory. */
  readonly directory: string
  /** Tailwind utility candidates; scanning is outside timing. */
  readonly tailwind: readonly string[]
  /** Native Tailwind theme declarations and scope overrides. */
  readonly tailwindCss: string
  /** Immutable CSS targets shared by every adapter in this fixture. */
  readonly targets: Readonly<NonNullable<Compilation.minify.Options['targets']>>
  /** Compatible Zyzz theme definitions. */
  readonly themes: Readonly<Record<'alternate' | 'base', Theme.Definition>>
  /** Validated Zyzz style graph; preparation is outside timing. */
  readonly zyzz: Style.Definition
  /** Unresolved token-name styles; validation and resolution occur inside timing. */
  readonly zyzzTokens: Readonly<Record<string, Style.Properties<Theme.Tokens>>>
}

/** Generates Panda semantic-token themes, extracts styles, and bundles exports. */
export async function panda(fixture: Fixture): Promise<Compilation.Bundle> {
  const context = await Panda.loadConfigAndCreateContext({
    cwd: fixture.directory,
  })

  await Panda.codegen(context)

  const file = Path.join(fixture.directory, 'panda.css')

  await Panda.cssgen(context, { cwd: fixture.directory, outfile: file })

  return {
    css: Compilation.minify(await Fs.readFile(file, 'utf8'), {
      targets: fixture.targets,
    }),
    javascript: await Compilation.javascript(
      `export {classes,themes} from ${JSON.stringify(Path.join(fixture.directory, 'panda.ts'))};`,
    ),
  }
}

/** Extracts StyleX variable and theme modules using the official Babel plugin. */
export async function stylex(fixture: Fixture): Promise<Compilation.Bundle> {
  const rules: Rule[] = []

  const result = await Esbuild.build({
    absWorkingDir: fixture.directory,
    bundle: true,
    entryPoints: ['stylex.ts'],
    format: 'iife',
    globalName: 'fixture',
    legalComments: 'none',
    minify: true,
    plugins: [
      {
        name: 'stylex-theme-extraction',
        setup(build) {
          build.onLoad({ filter: /\.ts$/ }, async ({ path }) => {
            const result = Babel.transformSync(
              await Fs.readFile(path, 'utf8'),
              {
                babelrc: false,
                configFile: false,
                filename: path,
                plugins: [
                  [
                    StylexPlugin,
                    {
                      dev: false,
                      runtimeInjection: false,
                      treeshakeCompensation: true,
                      unstable_moduleResolution: {
                        rootDir: fixture.directory,
                        type: 'commonJS',
                      },
                    },
                  ],
                ],
              },
            )

            const metadata = result?.metadata as { stylex?: Rule[] } | undefined
            if (!result?.code) throw new Error('StyleX did not emit a module.')

            rules.push(...(metadata?.stylex ?? []))

            return { contents: result.code, loader: 'ts' }
          })
        },
      },
    ],
    write: false,
  })
  if (!rules.length) throw new Error('StyleX did not emit theme rules.')

  const plugin = StylexPlugin as unknown as StyleXTransformObj

  return {
    css: Compilation.minify(plugin.processStylexRules(rules), {
      targets: fixture.targets,
    }),
    javascript: result.outputFiles[0]!.text,
  }
}

/** Builds Tailwind theme utilities and includes authored scope CSS and exports. */
export async function tailwind(fixture: Fixture): Promise<Compilation.Bundle> {
  const compiler = await Tailwind.compile(fixture.tailwindCss)

  return {
    css: Compilation.minify(
      compiler.build(fixture.tailwind.flatMap((classes) => classes.split(' '))),
      { targets: fixture.targets },
    ),
    javascript: await Compilation.javascript(
      `export const classes=${JSON.stringify(fixture.tailwind)};export const themes={alternate:{className:'alternate'},base:{className:'base'}};`,
    ),
  }
}

/** Native light-dark support keeps inherited and inline color-scheme selection intact. */
export const targets = {
  chrome: 123 << 16,
  firefox: 128 << 16,
  safari: (17 << 16) | (5 << 8),
}

/** Builds vanilla-extract contracts and scope implementations through esbuild. */
export async function vanillaExtract(
  fixture: Fixture,
): Promise<Compilation.Bundle> {
  const result = await Esbuild.build({
    absWorkingDir: fixture.directory,
    bundle: true,
    entryPoints: ['styles.css.ts'],
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
    throw new Error('vanilla-extract did not emit theme artifacts.')

  return {
    css: Compilation.minify(css, { targets: fixture.targets }),
    javascript,
  }
}

/** Emits a complete independent Zyzz graph and bundles actual class/scope exports. */
export async function zyzz(fixture: Fixture): Promise<Compilation.Bundle> {
  const output = Css.compile({
    composition: 'independent',
    styles: fixture.zyzz,
    themes: fixture.themes,
  })

  const themes = Object.fromEntries(
    Object.entries(output.themes).map(([name, className]) => [
      name,
      { className },
    ]),
  )

  return {
    css: Compilation.minify(output.css, { targets: fixture.targets }),
    javascript: await Compilation.javascript(
      `export const classes=${JSON.stringify(fixture.zyzz.styles.map(({ name }) => output.classes[name]))};export const themes=${JSON.stringify(themes)};`,
    ),
  }
}

/** Resolves token names, emits CSS, and bundles the same component/scope exports. */
export async function zyzzTokens(
  fixture: Fixture,
): Promise<Compilation.Bundle> {
  return zyzz({
    ...fixture,
    zyzz: Style.define(fixture.zyzzTokens, { theme: fixture.themes.base }),
  })
}
