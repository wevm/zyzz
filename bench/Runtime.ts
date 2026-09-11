/**
 * Builds equivalent production applications for runtime and browser comparisons.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { Transform } from 'zyzz/compiler'
import * as Compilation from './Compilation.js'
import * as Corpus from './Corpus.js'

/** Production application shapes measured independently. */
export const cases = [
  'cached',
  'direct',
  'callable',
  'overrides',
  'dynamic',
] as const

/** Existing comparison libraries plus a plain class/style control. */
export const libraries = [
  'baseline',
  'panda',
  'stylex',
  'tailwind',
  'vanilla-extract',
  'zyzz',
] as const

/** Browser props returned by every compiled application. */
export type Props = {
  /** Applied class list. */
  className: string
  /** Optional inline styling overrides. */
  style?: Record<string, string | number> | undefined
}

/** Fixed dynamic inputs shared by generated and native application controls. */
export type Input = Props & {
  /** Runtime opacity. */
  alpha: number
  /** Runtime width. */
  width: string
}

/** Frameworks with equivalent fixtures for a workload. Dynamic starts with a native control. */
export function librariesFor(
  kind: (typeof cases)[number],
): readonly (typeof libraries)[number][] {
  return kind === 'dynamic' ? ['baseline', 'zyzz'] : libraries
}

/** One production module and its required stylesheet. */
export type Bundle = Compilation.Bundle & {
  /** Applies one of the authored component styles. */
  apply: (index: number, overrides: Input) => Props
}

/** Alternating real styling inputs, allocated outside the timed calls. */
export const overrides: readonly Input[] = [
  {
    alpha: 0.5,
    width: '25px',
    className: 'external',
    style: { color: '#123456', paddingLeft: '2px' },
  },
  {
    alpha: 0.8,
    width: '75px',
    className: '',
    style: { color: '#654321', paddingLeft: '4px' },
  },
]

/** Compiles through official adapters before loading the emitted application. */
export async function create(options: create.Options): Promise<Bundle> {
  const { count, kind, library } = options
  const workload: Corpus.Case = { count, name: 'runtime', pattern: 'partial' }
  const fixture = await Compilation.create(workload)
  const literals = literalStyles(count)
  const names = literals.map((_, index) => `card${index}`)

  const application = (expressions: readonly string[], direct = false) => {
    if (kind === 'direct')
      return `export function apply(index) { switch(index) { ${expressions.map((expression, index) => `case ${index}:return ${direct ? `({className:${expression}})` : expression};`).join('')} } }`

    if (kind === 'cached')
      return `const applications = [${expressions.map((expression) => (direct ? `({className:${expression}})` : expression)).join(',')}];
        export function apply(index) { return applications[index]; }`

    if (direct)
      return `const classes = [${expressions.join(',')}];
        export function apply(index, overrides) {
          const className = classes[index];
          ${kind === 'callable' ? 'return { className };' : `return { className: overrides.className ? className + ' ' + overrides.className : className, style: overrides.style };`}
        }`

    return `const applications = [${expressions.map((expression) => `() => (${expression})`).join(',')}];
      export function apply(index, overrides) {
        const props = applications[index]();
        ${kind === 'callable' ? 'return props;' : `return { className: overrides.className ? props.className + ' ' + overrides.className : props.className, style: overrides.style };`}
      }`
  }

  try {
    const compiled = await (async (): Promise<Compilation.Bundle> => {
      if (kind === 'dynamic') {
        if (library === 'zyzz') {
          const definitions = literals.map((style) => {
            const { width: _width, opacity: _opacity, ...fixed } = style

            return `css((values:{width:\`\${number}px\`;alpha:number})=>({${JSON.stringify(fixed).slice(1, -1)},width:values.width,opacity:values.alpha}))`
          })
          const output = Transform.compile({
            moduleId: 'benchmark/runtime.ts',
            source: `import {css} from 'zyzz';const applications=[${definitions.join(',')}];export function apply(index,input){return applications[index](input)}`,
          })

          return {
            css: Compilation.minify(output.css),
            javascript: await bundle(output.code),
          }
        }

        const css = literals
          .map(
            (style, index) =>
              `.card${index}{${Object.entries({
                ...style,
                width: 'var(--width)',
                opacity: 'var(--alpha)',
              })
                .map(
                  ([key, value]) =>
                    `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(value)}`,
                )
                .join(';')}}`,
          )
          .join('')

        return {
          css: Compilation.minify(css),
          javascript: await bundle(
            `const classes=${JSON.stringify(names)};export function apply(index,input){const width=input.width;const alpha=input.alpha;const external=input.className;return {className:external?classes[index]+' '+external:classes[index],style:{...input.style,'--width':width,'--alpha':alpha}}}`,
          ),
        }
      }

      if (library === 'zyzz') {
        const definitions = literals.map(
          (style, index) => `${names[index]}: css(${JSON.stringify(style)})`,
        )

        const source = (() => {
          if (kind === 'direct')
            return `import {css} from 'zyzz'; const styles={${definitions.join(',')}}; ${application(names.map((name) => `styles.${name}()`))}`

          if (kind === 'cached')
            return `import { css } from 'zyzz'; ${application(literals.map((style) => `css(${JSON.stringify(style)})()`))}`

          return `import { css } from 'zyzz';
            const styles = { ${definitions.join(',')} };
            const applications = [${names.map((name) => `styles.${name}`).join(',')}];
            export function apply(index, overrides) {
              return applications[index](${kind === 'overrides' ? 'overrides' : ''});
            }`
        })()

        const output = Transform.compile({
          moduleId: 'benchmark/runtime.ts',
          source,
        })

        return {
          css: Compilation.minify(output.css),
          javascript: await bundle(output.code),
        }
      }

      if (library === 'baseline') {
        const css = literals
          .map(
            (style, index) =>
              `.card${index}{${Object.entries<unknown>(style)
                .map(
                  ([key, value]) =>
                    `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(value)}`,
                )
                .join(';')}}`,
          )
          .join('')

        return {
          css: Compilation.minify(css),
          javascript: await bundle(
            application(
              names.map((name) => JSON.stringify(name)),
              true,
            ),
          ),
        }
      }

      if (library === 'panda') {
        await Fs.writeFile(
          Path.join(fixture.directory, 'panda.ts'),
          `import { css } from './styled-system/css'; ${application(literals.map((style) => `({className:css(${JSON.stringify(style)})})`))}`,
        )
        // The compiler adapter re-exports classes; expose the application through it.
        await Fs.appendFile(
          Path.join(fixture.directory, 'panda.ts'),
          '\nexport const classes = apply;',
        )

        const output = await Compilation.panda(fixture)

        return {
          ...output,
          javascript: await bundle(
            `${output.javascript}\nexport const apply = fixture.classes;`,
          ),
        }
      }

      if (library === 'stylex') {
        fixture.stylex = `import * as stylex from '@stylexjs/stylex';
          const styles = stylex.create(${JSON.stringify(Object.fromEntries(literals.map((style, index) => [names[index], style])))});
          ${application(names.map((name) => `stylex.props(styles.${name})`))}`

        return Compilation.stylex(fixture)
      }

      const output = await Compilation.compilers[library](fixture)

      return {
        ...output,
        javascript: await bundle(
          `${output.javascript}\n${application(
            names.map((_, index) => `fixture.classes[${index}]`),
            true,
          )}`,
        ),
      }
    })()

    // Only compiled, bundled fixture code executes; authoring remains build-time.
    const exports = Vm.runInThisContext(
      `(() => {${compiled.javascript}; return fixture;})()`,
    ) as Pick<Bundle, 'apply'>
    if (typeof exports.apply !== 'function')
      throw new Error(`${library} emitted no application.`)

    return { ...compiled, apply: exports.apply }
  } finally {
    await Fs.rm(fixture.directory, { force: true, recursive: true })
  }
}

/** Reproducible production fixture dimensions. */
export declare namespace create {
  /** Shared dimensions for compilation, browser verification, and timing. */
  type Options = {
    /** Number of distinct authored styles. */
    count: number
    /** Cached props, surviving callables, or styling overrides. */
    kind: (typeof cases)[number]
    /** Official compiler adapter or native control. */
    library: (typeof libraries)[number]
  }
}

/** Verifies every component and both updates against independent native CSS. */
export async function verify(
  output: Bundle,
  options: create.Options,
): Promise<void> {
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()

    await page.setContent(
      '<!doctype html><html><head></head><body></body></html>',
    )
    await page.addStyleTag({ content: output.css })
    await page.addScriptTag({ content: output.javascript })

    const differences = await page.evaluate(
      ({ kind, literals, overrides }) => {
        const { apply } = (
          window as unknown as { fixture: Pick<Bundle, 'apply'> }
        ).fixture
        const differences: string[] = []

        for (const [index, literal] of literals.entries()) {
          const actual = document.createElement('div')
          const reference = document.createElement('div')

          document.body.append(actual, reference)

          for (const input of overrides) {
            const props = apply(index, input)

            actual.className = props.className
            actual.removeAttribute('style')

            for (const [key, value] of Object.entries(props.style ?? {})) {
              if (key.startsWith('--'))
                actual.style.setProperty(key, String(value))
              else Object.assign(actual.style, { [key]: value })
            }

            reference.removeAttribute('style')
            Object.assign(
              reference.style,
              literal,
              kind === 'overrides' || kind === 'dynamic' ? input.style : {},
              kind === 'dynamic'
                ? { width: input.width, opacity: input.alpha }
                : {},
            )

            const actualStyle = getComputedStyle(actual)
            const referenceStyle = getComputedStyle(reference)

            for (const property of new Set([
              ...Object.keys(literal),
              'paddingLeft',
              ...(kind === 'dynamic' ? ['width', 'opacity'] : []),
            ])) {
              const key = property.replace(
                /[A-Z]/g,
                (letter) => `-${letter.toLowerCase()}`,
              )

              if (
                actualStyle.getPropertyValue(key) !==
                referenceStyle.getPropertyValue(key)
              )
                differences.push(`${index}: ${key}`)
            }

            if (
              (kind === 'overrides' || kind === 'dynamic') &&
              input.className &&
              !actual.classList.contains(input.className)
            )
              differences.push(`${index}: external class`)
          }

          actual.remove()
          reference.remove()
        }

        return differences
      },
      {
        kind: options.kind,
        literals: literalStyles(options.count),
        overrides,
      },
    )
    if (differences.length)
      throw new Error(
        `${options.library} browser mismatch: ${differences.join(', ')}`,
      )
  } finally {
    await browser.close()
  }
}

async function bundle(source: string): Promise<string> {
  const result = await Esbuild.build({
    alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    bundle: true,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    format: 'iife',
    globalName: 'fixture',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    stdin: { contents: source, loader: 'ts', resolveDir: process.cwd() },
    write: false,
  })

  return result.outputFiles[0]!.text
}

/** Scalar corpus declarations for independent browser style verification. */
export function literalStyles(
  count: number,
): readonly Record<string, string | number>[] {
  return Corpus.styles({ count, name: 'runtime', pattern: 'partial' }).map(
    (style) =>
      Object.fromEntries(
        Object.entries<unknown>(style).map(([key, value]) => {
          if (typeof value !== 'string' && typeof value !== 'number')
            throw new Error('Runtime corpus requires scalar declarations.')

          return [key, value]
        }),
      ),
  )
}
