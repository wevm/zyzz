/** Measures query and typography compilation across the integration corpus and repeated workloads. @module */
import * as Fs from 'node:fs/promises'
import { bench, describe } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const directory = new URL('../../test/fixtures/', import.meta.url)
const corpus = await Promise.all(
  (await Fs.readdir(directory))
    .filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
    .map(async (name) => {
      const fixture = await import(new URL(name, directory).href)

      return { name, source: fixture.source as string | undefined }
    }),
)
const bundled = await Fs.readFile(
  new URL('../default.ts', import.meta.url),
  'utf8',
)
for (const count of [10, 100, 1000]) {
  const source =
    'import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem"},fontSize:{body:"1rem"},fontWeight:{medium:500}});' +
    Array.from(
      { length: count },
      (_, index) =>
        `export const body${index}=theme.style({fontSize:"body",fontWeight:"medium"})()`,
    ).join('\n')

  describe(`compile / typography and queries / ${count} styles`, () => {
    bench(
      'source',
      () => {
        Transform.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          moduleId: 'theme.ts',
          source,
        })
      },
      { time: 1000, warmupTime: 500 },
    )
    bench(
      'bundled source graph',
      () => {
        Graph.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          modules: {
            'default.ts': bundled,
            'app.ts':
              'import {style} from "./default.js";' +
              Array.from(
                { length: count },
                (_, index) =>
                  `export const body${index}=style({fontSize:"base",lineHeight:"normal"})()`,
              ).join('\n'),
          },
        })
      },
      { time: 1000, warmupTime: 500 },
    )
  })
}
describe('compile / integration corpus with query metadata', () => {
  bench(
    'all fixtures',
    () => {
      for (const fixture of corpus)
        if (fixture.source)
          Transform.compile({
            composition: 'independent',
            cssOutput: 'grouped',
            moduleId: fixture.name,
            source:
              fixture.source +
              '\nimport {Theme as QueryTheme} from "zyzz"; const queryTheme=QueryTheme.define({breakpoints:{tablet:"48rem"},fontSize:{body:"1rem"}}); export const queryBody=queryTheme.style({fontSize:"body"})()',
          })
    },
    { time: 1000, warmupTime: 500 },
  )
})
