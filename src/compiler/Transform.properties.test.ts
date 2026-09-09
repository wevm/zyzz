/** Compares the complete property surface and shorthand composition with native CSS. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'

const require = Module.createRequire(import.meta.url)
const properties: Record<
  string,
  { initial: string | readonly string[] }
> = require('mdn-data/css/properties.json')

describe('compile', () => {
  test('every property preserves native declaration and computed-style behavior', async () => {
    const samples = new Map<string, Conformance.Case[]>()
    for (const entry of Conformance.cases()) {
      if (
        ['inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(
          String(entry.value),
        )
      )
        continue
      const group = samples.get(entry.property) ?? []
      group.push(entry)
      samples.set(entry.property, group)
    }
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const selected = await page.evaluate(
        (groups) =>
          groups.map(([property, entries]) => ({
            property,
            entries: entries
              .filter(({ name, value }) => CSS.supports(name, String(value)))
              .slice(0, 3),
          })),
        [...samples].map(
          ([property, entries]) =>
            [
              property,
              entries.map((entry) => ({
                ...entry,
                name: Conformance.name(entry.property),
              })),
            ] as const,
        ),
      )
      const unsupported = selected
        .filter(({ entries }) => !entries.length)
        .map(({ property }) => Conformance.name(property))
        .sort()
      await Fs.mkdir('test-results', { recursive: true })
      await Fs.writeFile(
        'test-results/css-browser-capabilities.json',
        JSON.stringify({ browser: browser.version(), unsupported }, null, 2),
      )
      const cases = selected.flatMap(({ entries }) => entries)
      const covered = new Set(cases.map(({ name }) => name))
      expect(
        [
          'background',
          'box-shadow',
          'clip-path',
          'color',
          'font',
          'grid',
          'mask',
          'offset',
          'transition',
        ].filter((name) => !covered.has(name)),
      ).toMatchInlineSnapshot(`[]`)
      const failures: string[] = []
      for (let start = 0; start < cases.length; start += 100) {
        const batch = cases.slice(start, start + 100)
        const source = `import { css } from 'zyzz';\n${batch.map(({ property, value }, index) => `export const p${index} = css({${JSON.stringify(property)}: ${JSON.stringify(value)}})();`).join('\n')}`
        const output = Transform.compile({ moduleId: 'properties.ts', source })
        const javascript = await Esbuild.transform(output.code, {
          format: 'esm',
          loader: 'ts',
        })
        const module = await import(
          `data:text/javascript;base64,${Buffer.from(javascript.code).toString('base64')}`
        )
        const classes = batch.map(
          (_, index) => module[`p${index}`].className as string,
        )
        expect(classes.length === batch.length).toMatchInlineSnapshot(`true`)
        failures.push(
          ...(await page.evaluate(
            ({ batch, classes, css }) => {
              const sheet = document.createElement('style')
              sheet.textContent = css
              document.head.append(sheet)
              const failures: string[] = []
              for (const [index, { name, value }] of batch.entries()) {
                const actual = document.createElement('div')
                const control = document.createElement('div')
                actual.className = classes[index]!
                control.style.setProperty(name, String(value))
                document.body.append(actual, control)
                const compiled = getComputedStyle(actual).getPropertyValue(name)
                const native = getComputedStyle(control).getPropertyValue(name)
                if (compiled !== native)
                  failures.push(`${name}: ${value}: ${compiled} != ${native}`)
                actual.remove()
                control.remove()
              }
              sheet.remove()
              return failures
            },
            { batch, classes, css: output.css },
          )),
        )
      }
      expect(failures).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  }, 120_000)

  test('all browser-supported shorthand relationships retain repeated overrides', async () => {
    const cases = Conformance.cases()
    const byName = new Map<string, (string | number)[]>()
    for (const { property, value } of cases) {
      const name = Conformance.name(property)
      const group = byName.get(name) ?? []
      group.push(value)
      byName.set(name, group)
    }
    // Reset-only relationships are specified independently of shorthand value grammar.
    const resets: Record<string, readonly string[]> = {
      animation: [
        'animation-range-start',
        'animation-range-end',
        'animation-timeline',
      ],
      border: ['border-image-source'],
      font: [
        'font-kerning',
        'font-feature-settings',
        'font-size-adjust',
        'font-variation-settings',
      ],
      mask: ['mask-border-source'],
      'text-decoration': ['text-decoration-thickness'],
      'view-timeline': ['view-timeline-inset'],
    }
    function children(
      name: string,
      seen = new Set<string>(),
    ): readonly string[] {
      if (seen.has(name)) return []
      seen.add(name)
      const initial = properties[name]?.initial
      const direct = [
        ...(Array.isArray(initial) ? initial : []),
        ...(resets[name] ?? []),
      ]
      return [
        ...new Set(
          direct.flatMap((child) => [child, ...children(child, seen)]),
        ),
      ]
    }
    const pairs = Object.keys(properties).flatMap((shorthand) =>
      children(shorthand).map((longhand) => ({
        shorthand,
        longhand,
        values: byName.get(longhand) ?? [],
      })),
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const probes = await page.evaluate((pairs) => {
        const element = document.createElement('div')
        document.body.append(element)
        const output: { shorthand: string; longhand: string; value: string }[] =
          []
        for (const { shorthand, longhand, values } of pairs) {
          if (!CSS.supports(shorthand, 'initial')) continue
          for (const candidate of values) {
            const value = String(candidate)
            if (
              [
                'inherit',
                'initial',
                'revert',
                'revert-layer',
                'unset',
              ].includes(value) ||
              !CSS.supports(longhand, value)
            )
              continue
            element.style.cssText = ''
            element.style.setProperty(longhand, value)
            const before = getComputedStyle(element).getPropertyValue(longhand)
            element.style.setProperty(shorthand, 'initial')
            if (
              getComputedStyle(element).getPropertyValue(longhand) !== before
            ) {
              output.push({ shorthand, longhand, value })
              break
            }
          }
        }
        element.remove()
        return output
      }, pairs)
      expect(probes.length > 100).toMatchInlineSnapshot(`true`)
      const failures: string[] = []
      for (const { shorthand, longhand, value } of probes) {
        const camel = (name: string) =>
          name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        const output = Transform.compile({
          moduleId: 'cascade.ts',
          source: `import { css } from 'zyzz'; export const a = css({${camel(longhand)}: ${JSON.stringify(value)}})(); export const b = css({${camel(shorthand)}: 'initial'})(); export const c = css({${camel(longhand)}: ${JSON.stringify(value)}})();`,
        })
        const javascript = await Esbuild.transform(output.code, {
          format: 'esm',
          loader: 'ts',
        })
        const module = await import(
          `data:text/javascript;base64,${Buffer.from(javascript.code).toString('base64')}`
        )
        const classes = ['a', 'b', 'c'].map(
          (name) => module[name].className as string,
        )
        expect(classes.length).toMatchInlineSnapshot(`3`)
        const result = await page.evaluate(
          ({ classes, css, longhand, shorthand, value }) => {
            const sheet = document.createElement('style')
            sheet.textContent = css
            document.head.append(sheet)
            const actual = document.createElement('div')
            const control = document.createElement('div')
            actual.className = classes.join(' ')
            control.style.setProperty(shorthand, 'initial')
            control.style.setProperty(longhand, value)
            document.body.append(actual, control)
            const equal =
              getComputedStyle(actual).getPropertyValue(longhand) ===
              getComputedStyle(control).getPropertyValue(longhand)
            actual.remove()
            control.remove()
            sheet.remove()
            return equal
          },
          { classes, css: output.css, longhand, shorthand, value },
        )
        if (!result) failures.push(`${shorthand} resets ${longhand}`)
      }
      expect(failures).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  }, 120_000)
})
