/** Verifies configured output through source graphs, runtime props, and CSS maps. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Config } from 'zyzz'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('inherits output through config aliases, re-exports, and theme handles', () => {
    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const output = Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz';export const { css, variants, theme } = Config.create({cssOutput:'${cssOutput}',output:'html',theme:{color:{brand:'red'}}});`,
          'pkg/index.ts': `export { css as styled, variants, theme } from './config.js';`,
          'app.ts': `import { styled, variants, theme } from './pkg/index.js';
export const card=styled({color:'brand',padding:'8px'});
export const other=theme.css({color:'brand',padding:'8px'});
export const button=variants({base:{color:'brand',padding:'8px'},variants:{size:{large:{padding:'12px'}}}});
export const props=card();`,
        },
      })
      const app = output.modules['app.ts']!

      expect(app.code).not.toContain('styled({')
      expect(app.code).not.toContain('theme.css({')
      expect(app.code).toContain('CompositionHtml')
      expect(app.css).toContain('padding:8px;')
      expect(app.css).toContain('padding:12px;')
      const block = /\{color:[^{}]+;padding:8px;\}/.test(app.css)
      expect(block).toBe(cssOutput === 'grouped')
    }
  })

  test('mode changes invalidate class output and preserve declaration tracing', () => {
    const source = (mode: string) =>
      `import {Config} from 'zyzz';const {css}=Config.create({cssOutput:'${mode}'});export const card=css({color:'red',padding:'8px'});`
    const atomic = Transform.compile({
      moduleId: 'app.ts',
      source: source('atomic'),
    })
    const grouped = Transform.compile({
      moduleId: 'app.ts',
      source: source('grouped'),
    })

    expect(atomic.classes).not.toEqual(grouped.classes)
    for (const [mode, output] of [
      ['atomic', atomic],
      ['grouped', grouped],
    ] as const) {
      const lines = output.css.split('\n')
      const line = lines.findIndex((line) => line.includes('padding:8px'))
      const mapped = Trace.originalPositionFor(
        new Trace.TraceMap(output.cssMap),
        {
          column: lines[line]!.indexOf('padding:8px'),
          line: line + 1,
        },
      )
      expect(mapped.source).toBe('app.ts')
      expect(mapped.column).toBe(source(mode).indexOf("padding:'8px'"))
    }
  })

  test('rejects unsupported output options through config and extraction', () => {
    expect(() => Config.create({ cssOutput: 'automatic' } as never)).toThrow(
      'cssOutput must be atomic or grouped',
    )
    expect(() =>
      Transform.compile({
        moduleId: 'app.ts',
        source:
          "import {Config} from 'zyzz';const {css}=Config.create({cssOutput:'automatic'});const card=css({color:'red'});",
      }),
    ).toThrow('cssOutput must be atomic or grouped')
  })
})
