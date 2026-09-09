/**
 * Measures complete module rewriting, source maps, and generated delivery sizes.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Backgrounds from '../../test/fixtures/Backgrounds.js'
import * as Borders from '../../test/fixtures/Borders.js'
import * as Columns from '../../test/fixtures/Columns.js'
import * as Declarations from '../../test/fixtures/Declarations.js'
import * as Flex from '../../test/fixtures/Flex.js'
import * as Fonts from '../../test/fixtures/Fonts.js'
import * as Grid from '../../test/fixtures/Grid.js'
import * as Interaction from '../../test/fixtures/Interaction.js'
import * as Layout from '../../test/fixtures/Layout.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'
import * as Motion from '../../test/fixtures/Motion.js'
import * as Scrolling from '../../test/fixtures/Scrolling.js'
import * as Sizing from '../../test/fixtures/Sizing.js'
import * as Snapping from '../../test/fixtures/Snapping.js'
import * as Svg from '../../test/fixtures/Svg.js'
import * as Tables from '../../test/fixtures/Tables.js'
import * as TextDecoration from '../../test/fixtures/TextDecoration.js'
import * as TextFlow from '../../test/fixtures/TextFlow.js'
import * as Compilation from '../../bench/Compilation.js'

for (const kind of ['literal', 'theme', 'alias', 'tokens'] as const)
  for (const count of [10, 100, 1000]) {
    const header =
      kind !== 'literal'
        ? `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#fff' } }); const alternate = Theme.extend(theme, { color: { brand: '#000' } }); export const scope = alternate.className;`
        : `import { css } from 'zyzz';`
    const color = (() => {
      if (kind === 'tokens') {
        return 'theme.tokens.color.brand'
      }
      if (kind !== 'literal') {
        return "'brand'"
      }
      return "'#fff'"
    })()
    const source = `${header}\n${kind === 'alias' ? 'const { css } = theme;' : ''}\n${Array.from(
      { length: count },
      (_, index) =>
        `export const card${index} = ${kind === 'theme' || kind === 'tokens' ? 'theme.css' : 'css'}({ color: ${color}, padding: '${index}px' });`,
    ).join('\n')}`
    const name = (() => {
      if (kind === 'tokens') {
        return 'theme token transform'
      }
      if (kind === 'alias') {
        return 'theme alias transform'
      }
      if (kind === 'theme') {
        return 'theme source transform'
      }
      return 'module transform'
    })()
    describe(`${name} / ${count} styles`, () => {
      bench(
        'extract + emit + rewrite + maps',
        () => {
          Transform.compile({ moduleId: 'example/cards.ts', source })
        },
        {
          iterations: 30,
          setup: async () => {
            const output = Transform.compile({
              moduleId: 'example/cards.ts',
              source,
            })
            const bundle = await Esbuild.build({
              alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
              bundle: true,
              format: 'esm',
              minify: true,
              stdin: {
                contents: output.code,
                loader: 'ts',
                resolveDir: process.cwd(),
              },
              write: false,
            })
            const cssText = Compilation.minify(output.css)
            const javascriptText = bundle.outputFiles[0]!.text
            const measure = (value: string) => ({
              brotli: Zlib.brotliCompressSync(value).byteLength,
              gzip: Zlib.gzipSync(value).byteLength,
              raw: Buffer.byteLength(value),
            })
            const css = measure(cssText)
            const javascript = measure(javascriptText)
            const directory = Path.resolve('bench/results/transform')
            await Fs.mkdir(directory, { recursive: true })
            await Fs.writeFile(
              Path.join(directory, `${kind}-${count}.json`),
              JSON.stringify(
                {
                  composition: 'ordered',
                  count,
                  css,
                  javascript,
                  kind,
                  maps: {
                    css: measure(JSON.stringify(output.cssMap)),
                    javascript: measure(JSON.stringify(output.map)),
                  },
                  total: {
                    brotli: css.brotli + javascript.brotli,
                    gzip: css.gzip + javascript.gzip,
                    raw: css.raw + javascript.raw,
                  },
                },
                null,
                2,
              ),
            )
            await Fs.writeFile(
              Path.join(directory, `${kind}-${count}.css`),
              cssText,
            )
            await Fs.writeFile(
              Path.join(directory, `${kind}-${count}.js`),
              javascriptText,
            )
          },
          time: 1000,
          warmupIterations: 10,
          warmupTime: 500,
        },
      )
    })
  }

for (const count of [10, 100]) {
  const source =
    Declarations.source +
    Array.from(
      { length: count },
      (_, index) =>
        `export const fallback${index} = css({color:['#000','brand!'],padding:['0px','${index}px']})();`,
    ).join('\n')
  describe(`fallback transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({ moduleId: 'example/fallbacks.ts', source })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

const workloads = {
  backgrounds: {
    declaration: (index: number) =>
      `export const bg${index} = css({backgroundPositionX:'${index}px',backgroundPositionY:'50%',backgroundSize:'cover',backgroundRepeat:'no-repeat',accentColor:'auto'})();`,
    source: Backgrounds.source,
    title: 'background',
  },
  borders: {
    declaration: (index: number) =>
      `export const box${index} = css({borderStyle:'solid',borderWidth:'2px',borderInlineStartWidth:'${index}px',borderStartStartRadius:'8px',outlineWidth:'1px'})();`,
    source: Borders.source,
    title: 'border',
  },
  columns: {
    declaration: (index: number) =>
      `export const col${index} = css({columnWidth:'${index}px',columnCount:2,columnFill:'balance',breakInside:'avoid-column'})();`,
    source: Columns.source,
    title: 'column',
  },
  decoration: {
    declaration: (index: number) =>
      `export const link${index} = css({textDecorationLine:['underline','underline overline!'],textDecorationStyle:'dotted',textDecorationThickness:'2px',textUnderlineOffset:'${index}px'})();`,
    source: TextDecoration.source,
    title: 'text decoration',
  },
  flex: {
    declaration: (index: number) =>
      `export const box${index} = css({flexBasis:'${index}px',alignSelf:'center',order:${index},overflow:['hidden','clip!'],overflowX:'auto'})();`,
    source: Flex.source,
    title: 'flex layout',
  },
  fonts: {
    declaration: (index: number) =>
      `export const text${index} = css({fontKerning:'normal',fontVariantNumeric:'tabular-nums',textEmphasisStyle:'open circle',textEmphasisColor:'#06c',letterSpacing:'${index}px'})();`,
    source: Fonts.source,
    title: 'font',
  },
  grid: {
    declaration: (index: number) =>
      `export const cell${index} = css({display:'grid',gridAutoColumns:'1fr',gridAutoRows:'${index}px',gridAutoFlow:'column',gridColumnEnd:'span 2'})();`,
    source: Grid.source,
    title: 'grid',
  },
  interaction: {
    declaration: (index: number) =>
      `export const control${index} = css({width:'${index}px',cursor:'pointer',pointerEvents:['auto','none!'],resize:'inline',userSelect:'all',visibility:'visible'})();`,
    source: Interaction.source,
    title: 'interaction',
  },
  layout: {
    declaration: (index: number) =>
      `export const box${index} = css({display:'flow-root',contain:'layout',isolation:'isolate',zIndex:${index},objectFit:'cover'})();`,
    source: Layout.source,
    title: 'layout containment',
  },
  logical: {
    declaration: (index: number) =>
      `export const box${index} = css({inlineSize:'${index}px',paddingInline:['1px','2px!'],marginBlock:'-1px',insetBlockStart:0})();`,
    source: Logical.source,
    title: 'logical box',
  },
  motion: {
    declaration: (index: number) =>
      `export const motion${index} = css({animationDelay:'-${index}ms',animationDuration:'1s',animationIterationCount:'infinite',animationTimingFunction:'linear',transitionDuration:'250ms'})();`,
    source: Motion.source,
    title: 'motion',
  },
  scrolling: {
    declaration: (index: number) =>
      `export const box${index} = css({scrollMarginBlockStart:'${index}px',scrollPadding:['10%','20px!'],overscrollBehavior:'contain',scrollBehavior:'smooth'})();`,
    source: Scrolling.source,
    title: 'scroll spacing',
  },
  sizing: {
    declaration: (index: number) =>
      `export const box${index} = css({width:['${index}px','fit-content!'],minInlineSize:'min-content',maxInlineSize:'none',flexBasis:'content'})();`,
    source: Sizing.source,
    title: 'intrinsic sizing',
  },
  snapping: {
    declaration: (index: number) =>
      `export const slide${index} = css({scrollMarginInlineStart:'${index}px',scrollSnapAlign:'start center',scrollSnapStop:'always',scrollSnapType:['inline proximity','inline mandatory!']})();`,
    source: Snapping.source,
    title: 'scroll snap',
  },
  svg: {
    declaration: (index: number) =>
      `export const path${index} = css({fill:'#06c',stroke:'black',strokeWidth:'${index}px',fillRule:'evenodd',strokeLinecap:'round'})();`,
    source: Svg.source,
    title: 'SVG',
  },
  tables: {
    declaration: (index: number) =>
      `export const table${index} = css({borderCollapse:'separate',borderSpacing:['1px','${index}px!'],captionSide:'bottom',emptyCells:'hide',tableLayout:'fixed'})();`,
    source: Tables.source,
    title: 'table',
  },
  text: {
    declaration: (index: number) =>
      `export const text${index} = css({textIndent:'${index}px',letterSpacing:['normal','1px!'],overflowWrap:'anywhere',whiteSpace:'pre-wrap',textOverflow:'ellipsis'})();`,
    source: TextFlow.source,
    title: 'text flow',
  },
}
for (const [kind, workload] of Object.entries(workloads))
  for (const count of [10, 100]) {
    const source =
      workload.source +
      Array.from({ length: count }, (_, index) =>
        workload.declaration(index),
      ).join('\n')
    describe(`${workload.title} transform / ${count} additional styles`, () => {
      bench(
        'extract + emit + rewrite + maps',
        () => {
          Transform.compile({ moduleId: `example/${kind}.ts`, source })
        },
        {
          iterations: 30,
          setup: async () => {
            const output = Transform.compile({
              moduleId: `example/${kind}.ts`,
              source,
            })
            const bundle = await Esbuild.build({
              alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
              bundle: true,
              format: 'esm',
              minify: true,
              stdin: {
                contents: output.code,
                loader: 'ts',
                resolveDir: process.cwd(),
              },
              write: false,
            })
            const measure = (text: string) => ({
              brotli: Zlib.brotliCompressSync(text).byteLength,
              gzip: Zlib.gzipSync(text).byteLength,
              raw: Buffer.byteLength(text),
            })
            const css = measure(Compilation.minify(output.css))
            const javascript = measure(bundle.outputFiles[0]!.text)
            await Fs.mkdir('bench/results/transform', { recursive: true })
            await Fs.writeFile(
              `bench/results/transform/${kind}-${count}.json`,
              JSON.stringify(
                {
                  count,
                  css,
                  javascript,
                  maps: {
                    css: measure(JSON.stringify(output.cssMap)),
                    javascript: measure(JSON.stringify(output.map)),
                  },
                  total: {
                    brotli: css.brotli + javascript.brotli,
                    gzip: css.gzip + javascript.gzip,
                    raw: css.raw + javascript.raw,
                  },
                },
                null,
                2,
              ),
            )
          },
          time: 1000,
          warmupIterations: 10,
          warmupTime: 500,
        },
      )
    })
  }

for (const count of [10, 100]) {
  const source =
    Lengths.source +
    Array.from(
      { length: count },
      (_, index) =>
        `export const length${index} = css({width:['50vw','${index}cqi!'],padding:'1lh',height:'10dvh'})();`,
    ).join('\n')
  describe(`standard length transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({ moduleId: 'example/lengths.ts', source })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}
