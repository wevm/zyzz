/** Verifies atomic ownership and independent cascade through public compiler flows. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('maps repeated declaration occurrences to their authored keys', () => {
    const source = `import {css} from 'zyzz'; export const card=css({padding:'8px',paddingLeft:'2px',selectors:{'&:hover':{paddingLeft:'4px'},'&:focus':{paddingLeft:'6px'}}})`
    const output = Transform.compile({ moduleId: 'atomic.ts', source })
    const map = new Trace.TraceMap(output.cssMap)
    const locations = [...output.css.matchAll(/padding-left:/g)].map(
      (match) => {
        const prefix = output.css.slice(0, match.index).split('\n')
        return Trace.originalPositionFor(map, {
          column: prefix.at(-1)!.length,
          line: prefix.length,
        }).column
      },
    )

    expect(locations).toMatchInlineSnapshot(`
      [
        63,
        103,
        133,
      ]
    `)
  })

  test('deduplicates whole independent applications without reversing conflicts', async () => {
    const a = { padding: '10px', paddingLeft: '1px' } as const
    const output = Css.compile({
      composition: 'independent',
      styles: Style.define({
        a,
        b: { paddingLeft: '1px', padding: '10px' },
        again: a,
      }),
    })

    expect(output.classes).toMatchInlineSnapshot(`
      {
        "a": "z-p-10px-CgmKfH-0 z-pl-1px-CgmKfH-1",
        "again": "z-p-10px-CgmKfH-0 z-pl-1px-CgmKfH-1",
        "b": "z-pl-1px-0kXiVX-0 z-p-10px-0kXiVX-1",
      }
    `)
    expect(output.css).toMatchInlineSnapshot(`
      ".z-p-10px-CgmKfH-0{padding:10px;}
      .z-pl-1px-CgmKfH-1{padding-left:1px;}
      .z-pl-1px-0kXiVX-0{padding-left:1px;}
      .z-p-10px-0kXiVX-1{padding:10px;}"
    `)

    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style>${Object.entries(output.classes)
          .map(([id, name]) => `<div id="${id}" class="${name}"></div>`)
          .join('')}`,
      )
      expect(
        await page
          .locator('div')
          .evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).paddingLeft),
          ),
      ).toMatchInlineSnapshot(`
        [
          "1px",
          "10px",
          "1px",
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('development class names survive offsets and declaration insertion', () => {
    const source = (value: string, added = '') =>
      `import {css} from 'zyzz'; const first=css({color:'${value}'}); const second=css({${added}color:'blue',padding:'8px'})`
    const before = Transform.compile({
      development: true,
      moduleId: 'dev.ts',
      source: source('red'),
    })
    const after = Transform.compile({
      development: true,
      moduleId: 'dev.ts',
      source: source('rebeccapurple', "display:'block',"),
    })
    const previous = Object.values(before.classes)[1]!.split(' ')
    const current = Object.values(after.classes)[1]!.split(' ')
    expect(
      previous.every((name) => current.includes(name)),
    ).toMatchInlineSnapshot('true')
  })
})
