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
import * as BorderLists from '../../test/fixtures/BorderLists.js'
import * as BorderShorthand from '../../test/fixtures/BorderShorthand.js'
import * as Borders from '../../test/fixtures/Borders.js'
import * as BoxLists from '../../test/fixtures/BoxLists.js'
import * as Colors from '../../test/fixtures/Colors.js'
import * as Columns from '../../test/fixtures/Columns.js'
import * as ContainerSizing from '../../test/fixtures/ContainerSizing.js'
import * as Controls from '../../test/fixtures/Controls.js'
import * as Declarations from '../../test/fixtures/Declarations.js'
import * as Flex from '../../test/fixtures/Flex.js'
import * as Fonts from '../../test/fixtures/Fonts.js'
import * as FunctionalColors from '../../test/fixtures/FunctionalColors.js'
import * as Grid from '../../test/fixtures/Grid.js'
import * as GridLists from '../../test/fixtures/GridLists.js'
import * as Prefixed from '../../test/fixtures/Prefixed.js'
import * as Percentage from '../../test/fixtures/Percentage.js'
import * as GridLines from '../../test/fixtures/GridLines.js'
import * as Ranges from '../../test/fixtures/Ranges.js'
import * as Tuples from '../../test/fixtures/Tuples.js'
import * as Corners from '../../test/fixtures/Corners.js'
import * as Geometry from '../../test/fixtures/Geometry.js'
import * as Identifiers from '../../test/fixtures/Identifiers.js'
import * as Interaction from '../../test/fixtures/Interaction.js'
import * as KeywordGroups from '../../test/fixtures/KeywordGroups.js'
import * as Layout from '../../test/fixtures/Layout.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'
import * as Masks from '../../test/fixtures/Masks.js'
import * as MathExpressions from '../../test/fixtures/MathExpressions.js'
import * as Motion from '../../test/fixtures/Motion.js'
import * as MotionLists from '../../test/fixtures/MotionLists.js'
import * as Reading from '../../test/fixtures/Reading.js'
import * as Scalars from '../../test/fixtures/Scalars.js'
import * as Scrolling from '../../test/fixtures/Scrolling.js'
import * as Sizing from '../../test/fixtures/Sizing.js'
import * as Snapping from '../../test/fixtures/Snapping.js'
import * as Substitution from '../../test/fixtures/Substitution.js'
import * as Svg from '../../test/fixtures/Svg.js'
import * as Tables from '../../test/fixtures/Tables.js'
import * as TextDecoration from '../../test/fixtures/TextDecoration.js'
import * as TextTimeline from '../../test/fixtures/TextTimeline.js'
import * as TextFlow from '../../test/fixtures/TextFlow.js'
import * as Compilation from '../../bench/Compilation.js'

for (const kind of ['literal', 'theme', 'alias', 'tokens'] as const)
  for (const count of [10, 100, 1000]) {
    const header =
      kind !== 'literal'
        ? "import {Config} from 'zyzz';\nimport { Vars } from 'zyzz'; const theme = Vars.define({ color: { brand: '#fff' } }); const themeConfig=Config.create({vars:theme}); const alternate = Vars.extend(theme, { color: { brand: '#000' } }); const alternateConfig=Config.create({vars:alternate}); export const scope = alternateConfig.vars().className;"
        : `import { style } from 'zyzz';`

    const color = (() => {
      if (kind === 'tokens') {
        return 'theme.tokens.color.brand'
      }

      if (kind !== 'literal') {
        return "'brand'"
      }

      return "'#fff'"
    })()

    const source = `${header}\n${kind === 'alias' ? 'const { style } = theme;' : ''}\n${Array.from(
      { length: count },
      (_, index) =>
        `export const card${index} = ${kind === 'theme' || kind === 'tokens' ? 'theme.style' : 'style'}({ color: ${color}, padding: '${index}px' });`,
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
          Transform.compile({
            composition: 'independent',
            cssOutput: 'grouped',
            moduleId: 'example/cards.ts',
            source,
          })
        },
        {
          iterations: 30,
          setup: async () => {
            const output = Transform.compile({
              composition: 'independent',
              cssOutput: 'grouped',
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
        `export const fallback${index} = style({color:['#000','brand !important'],padding:['0px','${index}px']})();`,
    ).join('\n')

  describe(`fallback transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          moduleId: 'example/fallbacks.ts',
          source,
        })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

const workloads = {
  backgrounds: {
    declaration: (index: number) =>
      `export const bg${index} = style({backgroundPositionX:'${index}px',backgroundPositionY:'50%',backgroundSize:'cover',backgroundRepeat:'no-repeat',accentColor:'auto'})();`,
    source: Backgrounds.source,
    title: 'background',
  },
  borderShorthand: {
    declaration: (index: number) =>
      `export const border${index} = style({border:'${index}px solid red',borderInlineStart:'blue dashed 4px',outline:'1px dotted black'})();`,
    source: BorderShorthand.source,
    title: 'border shorthand',
  },
  borderLists: {
    declaration: (index: number) =>
      `export const borderList${index} = style({borderColor:'red rgb(0 128 0) blue gold',borderRadius:'${index}px 20px / 30px 40px'})();`,
    source: BorderLists.source,
    title: 'border list',
  },
  borders: {
    declaration: (index: number) =>
      `export const box${index} = style({borderStyle:'solid',borderWidth:'2px',borderInlineStartWidth:'${index}px',borderStartStartRadius:'8px',outlineWidth:'1px'})();`,
    source: Borders.source,
    title: 'border',
  },
  colors: {
    declaration: (index: number) =>
      `export const named${index} = style({color:'rebeccapurple',backgroundColor:'aliceblue',fill:'gold',stroke:'navy',padding:'${index}px'})();`,
    source: Colors.source,
    title: 'named color',
  },
  boxLists: {
    declaration: (index: number) =>
      `export const boxList${index} = style({padding:'${index}px 8px 12px 16px',marginInline:'2px auto'})();`,
    source: BoxLists.source,
    title: 'box list',
  },
  columns: {
    declaration: (index: number) =>
      `export const col${index} = style({columnWidth:'${index}px',columnCount:2,columnFill:'balance',breakInside:'avoid-column'})();`,
    source: Columns.source,
    title: 'column',
  },
  decoration: {
    declaration: (index: number) =>
      `export const link${index} = style({textDecorationLine:['underline','underline overline !important'],textDecorationStyle:'dotted',textDecorationThickness:'2px',textUnderlineOffset:'${index}px'})();`,
    source: TextDecoration.source,
    title: 'text decoration',
  },
  containerSizing: {
    declaration: (index: number) =>
      `export const field${index} = style({containerType:'inline-size',fieldSizing:'content',interpolateSize:'allow-keywords',padding:'${index}px'})();`,
    source: ContainerSizing.source,
    title: 'container sizing',
  },
  controls: {
    declaration: (index: number) =>
      `export const control${index} = style({tabSize:${index},touchAction:'pan-x pinch-zoom',listStyleType:'upper-roman',scrollbarWidth:'thin'})();`,
    source: Controls.source,
    title: 'control',
  },
  flex: {
    declaration: (index: number) =>
      `export const box${index} = style({flexBasis:'${index}px',alignSelf:'center',order:${index},overflow:['hidden','clip !important'],overflowX:'auto'})();`,
    source: Flex.source,
    title: 'flex layout',
  },
  fonts: {
    declaration: (index: number) =>
      `export const text${index} = style({fontKerning:'normal',fontVariantNumeric:'tabular-nums',textEmphasisStyle:'open circle',textEmphasisColor:'#06c',letterSpacing:'${index}px'})();`,
    source: Fonts.source,
    title: 'font',
  },
  gridLists: {
    declaration: (index: number) =>
      `export const tracks${index} = style({gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gridAutoRows:'${index}px 40px'})();`,
    source: GridLists.source,
    title: 'grid list',
  },
  functionalColors: {
    declaration: (index: number) =>
      `export const functionalColor${index} = style({color:'oklch(.5 .1 ${index})',backgroundColor:'rgb(255 0 0 / 50%)'})();`,
    source: FunctionalColors.source,
    title: 'functional color',
  },
  grid: {
    declaration: (index: number) =>
      `export const cell${index} = style({display:'grid',gridAutoColumns:'1fr',gridAutoRows:'${index}px',gridAutoFlow:'column',gridColumnEnd:'span 2'})();`,
    source: Grid.source,
    title: 'grid',
  },
  prefixed: {
    declaration: (index: number) =>
      `export const prefixed${index} = style({WebkitBorderBefore:'${index}px solid red',WebkitTextFillColor:'rgb(10 20 30)',MsContentZoomLimitMax:'200%',MozAppearance:'button'})();`,
    source: Prefixed.source,
    title: 'prefixed',
  },
  percentage: {
    declaration: (index: number) =>
      `export const percentage${index} = style({fontWidth:'${100 + index}%',textSizeAdjust:'110%',opacity:'${index}%',zoom:'125%'})();`,
    source: Percentage.source,
    title: 'percentage',
  },
  tuples: {
    declaration: (index: number) =>
      `export const tuple${index} = style({borderImageSlice:'25% fill',borderImageWidth:'1 2 3 4',borderImageOutset:'${index}px 2px',scrollbarColor:'red blue'})();`,
    source: Tuples.source,
    title: 'scalar tuple',
  },
  gridLines: {
    declaration: (index: number) =>
      `export const grid${index} = style({gridArea:'1 / 2 / 3 / 4',gridColumnStart:'span content 2'})();`,
    source: GridLines.source,
    title: 'grid placement',
  },
  ranges: {
    declaration: (index: number) =>
      `export const range${index} = style({animationRangeStart:'entry ${index}%',animationRangeEnd:'exit 80%'})();`,
    source: Ranges.source,
    title: 'timeline range',
  },
  corners: {
    declaration: (index: number) =>
      `export const corner${index} = style({borderRadius:'${index}px',cornerShape:'superellipse(2) bevel',gridGap:'10px 20px',justifySelf:'safe end'})();`,
    source: Corners.source,
    title: 'corner and layout',
  },
  geometry: {
    declaration: (index: number) =>
      `export const transformed${index} = style({transform:'translate(${index}px,20%) rotate(45deg) scale(2,3)',aspectRatio:'16/9'})();`,
    source: Geometry.source,
    title: 'geometry',
  },
  identifiers: {
    declaration: (index: number) =>
      `export const named${index} = style({animationName:'Fade${index}',containerName:'Card${index} Secondary',anchorName:'--Anchor${index}',transitionProperty:'opacity, transform'})();`,
    source: Identifiers.source,
    title: 'custom identifier',
  },
  interaction: {
    declaration: (index: number) =>
      `export const control${index} = style({width:'${index}px',cursor:'pointer',pointerEvents:['auto','none !important'],resize:'inline',userSelect:'all',visibility:'visible'})();`,
    source: Interaction.source,
    title: 'interaction',
  },
  keywordGroups: {
    declaration: (index: number) =>
      `export const keywordGroup${index} = style({fontVariantNumeric:'oldstyle-nums tabular-nums slashed-zero',contain:'layout style paint',padding:'${index}px'})();`,
    source: KeywordGroups.source,
    title: 'keyword group',
  },
  layout: {
    declaration: (index: number) =>
      `export const box${index} = style({display:'flow-root',contain:'layout',isolation:'isolate',zIndex:${index},objectFit:'cover'})();`,
    source: Layout.source,
    title: 'layout containment',
  },
  logical: {
    declaration: (index: number) =>
      `export const box${index} = style({inlineSize:'${index}px',paddingInline:['1px','2px !important'],marginBlock:'-1px',insetBlockStart:0})();`,
    source: Logical.source,
    title: 'logical box',
  },
  reading: {
    declaration: (index: number) =>
      `export const item${index} = style({readingFlow:'source-order',readingOrder:${index}})();`,
    source: Reading.source,
    title: 'reading order',
  },
  masks: {
    declaration: (index: number) =>
      `export const mask${index} = style({maskPosition:'${index}px',maskSize:'50%',maskRepeat:'no-repeat',maskMode:'alpha',transformOrigin:'center'})();`,
    source: Masks.source,
    title: 'mask',
  },
  motionLists: {
    declaration: (index: number) =>
      `export const motionList${index} = style({transitionDuration:'${index}ms, 1s',transitionTimingFunction:'steps(4, end), cubic-bezier(0, -1, 1, 2)'})();`,
    source: MotionLists.source,
    title: 'motion list',
  },
  mathExpressions: {
    declaration: (index: number) =>
      `export const math${index} = style({width:'calc(50% - ${index}px)',padding:'calc(2px * 3) min(20px, 5%)'})();`,
    source: MathExpressions.source,
    title: 'math expression',
  },
  motion: {
    declaration: (index: number) =>
      `export const motion${index} = style({animationDelay:'-${index}ms',animationDuration:'1s',animationIterationCount:'infinite',animationTimingFunction:'linear',transitionDuration:'250ms'})();`,
    source: Motion.source,
    title: 'motion',
  },
  scalars: {
    declaration: (index: number) =>
      `export const scalar${index} = style({cx:'${index}px',cy:'20px',r:'10px',textWrapMode:'nowrap',caretShape:'bar'})();`,
    source: Scalars.source,
    title: 'remaining scalar',
  },
  scrolling: {
    declaration: (index: number) =>
      `export const box${index} = style({scrollMarginBlockStart:'${index}px',scrollPadding:['10%','20px !important'],overscrollBehavior:'contain',scrollBehavior:'smooth'})();`,
    source: Scrolling.source,
    title: 'scroll spacing',
  },
  sizing: {
    declaration: (index: number) =>
      `export const box${index} = style({width:['${index}px','fit-content !important'],minInlineSize:'min-content',maxInlineSize:'none',flexBasis:'content'})();`,
    source: Sizing.source,
    title: 'intrinsic sizing',
  },
  snapping: {
    declaration: (index: number) =>
      `export const slide${index} = style({scrollMarginInlineStart:'${index}px',scrollSnapAlign:'start center',scrollSnapStop:'always',scrollSnapType:['inline proximity','inline mandatory !important']})();`,
    source: Snapping.source,
    title: 'scroll snap',
  },
  textTimeline: {
    declaration: (index: number) =>
      `export const line${index} = style({flexFlow:'row wrap',textWrap:'wrap balance',verticalAlign:'${index}px',viewTimelineAxis:'block, x'})();`,
    source: TextTimeline.source,
    title: 'text timeline',
  },
  substitution: {
    declaration: (index: number) =>
      `export const substituted${index} = style({width:'calc(var(--width, 100px) - ${index}px)',color:'var(--ink, var(--fallback, blue))'})();`,
    source: Substitution.source,
    title: 'variable substitution',
  },
  svg: {
    declaration: (index: number) =>
      `export const path${index} = style({fill:'#06c',stroke:'black',strokeWidth:'${index}px',fillRule:'evenodd',strokeLinecap:'round'})();`,
    source: Svg.source,
    title: 'SVG',
  },
  tables: {
    declaration: (index: number) =>
      `export const table${index} = style({borderCollapse:'separate',borderSpacing:['1px','${index}px !important'],captionSide:'bottom',emptyCells:'hide',tableLayout:'fixed'})();`,
    source: Tables.source,
    title: 'table',
  },
  text: {
    declaration: (index: number) =>
      `export const text${index} = style({textIndent:'${index}px',letterSpacing:['normal','1px !important'],overflowWrap:'anywhere',whiteSpace:'pre-wrap',textOverflow:'ellipsis'})();`,
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
          Transform.compile({
            composition: 'independent',
            cssOutput: 'grouped',
            moduleId: `example/${kind}.ts`,
            source,
          })
        },
        {
          iterations: 30,
          setup: async () => {
            const output = Transform.compile({
              composition: 'independent',
              cssOutput: 'grouped',
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
        `export const length${index} = style({width:['50vw','${index}cqi !important'],padding:'1lh',height:'10dvh'})();`,
    ).join('\n')

  describe(`standard length transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          moduleId: 'example/lengths.ts',
          source,
        })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

for (const count of [0, 100]) {
  const source = `import {style} from 'zyzz';\n${Array.from(
    { length: count },
    (_, index) =>
      `const unused${index} = style({padding:'${index}px',color:'red'});`,
  ).join('\n')}\nexport const card = style({padding:'8px',color:'blue'});`

  describe(`reachability / ${count} unused styles`, () => {
    bench(
      'extract + prune + emit + maps',
      () => {
        Transform.compile({
          cssOutput: 'grouped',
          moduleId: 'pruning.ts',
          source,
        })
      },
      {
        iterations: 30,
        setup: async () => {
          const output = Transform.compile({
            cssOutput: 'grouped',
            moduleId: 'pruning.ts',
            source,
          })
          const bundle = await Esbuild.build({
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
          const css = Compilation.minify(output.css)
          const javascript = bundle.outputFiles[0]!.text
          const directory = Path.resolve('bench/results/reachability')

          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(
            Path.join(directory, `${count}.json`),
            JSON.stringify(
              {
                count,
                css: measure(css),
                javascript: measure(javascript),
                total: {
                  brotli: measure(css).brotli + measure(javascript).brotli,
                  gzip: measure(css).gzip + measure(javascript).gzip,
                  raw: Buffer.byteLength(css) + Buffer.byteLength(javascript),
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
