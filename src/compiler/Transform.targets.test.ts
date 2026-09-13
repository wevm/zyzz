/** Reviews browser rule retention through source and packed compilation against native controls. @module */
import * as Fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Targets from '../../test/fixtures/AtRuleTargets.js'

describe('compile', () => {
  test('reviews Chromium rule and descriptor retention against independent native controls', async () => {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      const page = await browser.newPage()
      const report: Record<string, readonly string[]> = {}

      for (const [name, fixture] of Object.entries(Targets.rules)) {
        const library = Graph.compile({
          modules: { 'rules.ts': fixture.source },
        })
        const packed = Graph.compile({
          contracts: { 'rules.js': library.contracts['rules.ts']! },
          imports: { 'app.ts': { rules: 'rules.js' } },
          modules: { 'app.ts': `import 'rules';` },
        })
        const outputs = [
          fixture.css,
          library.sharedCss ?? '',
          packed.sharedCss ?? '',
        ]
        const retained: string[][] = []

        for (const css of outputs) {
          retained.push(
            await page.evaluate(
              ({ css, name }) => {
                const element = document.createElement('style')
                element.textContent = css
                document.head.append(element)

                try {
                  const visit = (rules: CSSRuleList): string[] => {
                    for (const rule of rules) {
                      if (
                        rule.cssText.startsWith(`${name} `) ||
                        rule.cssText.startsWith(`${name}{`) ||
                        rule.cssText.startsWith(`${name} {`)
                      ) {
                        const descriptors = [
                          ...rule.cssText.matchAll(
                            /(?<=[;{}])\s*(@?[a-z][a-z-]*)\s*[:{]/g,
                          ),
                        ]
                          .map((match) => match[1]!)
                          .filter(
                            (value) =>
                              value !== 'body' && !value.startsWith('alias'),
                          )

                        return [...new Set([name, ...descriptors])].sort()
                      }

                      if ('cssRules' in rule) {
                        const nested = visit((rule as CSSGroupingRule).cssRules)
                        if (nested.length) return nested
                      }
                    }

                    return []
                  }

                  return visit(element.sheet!.cssRules)
                } finally {
                  element.remove()
                }
              },
              { css, name },
            ),
          )
        }

        expect(
          JSON.stringify(retained[1]) === JSON.stringify(retained[0]),
        ).toMatchInlineSnapshot('true')
        expect(
          JSON.stringify(retained[2]) === JSON.stringify(retained[0]),
        ).toMatchInlineSnapshot('true')
        report[name] = retained[0]!
      }

      expect(report).toMatchInlineSnapshot(`
        {
          "@container": [
            "@container",
            "color",
          ],
          "@counter-style": [
            "@counter-style",
            "additive-symbols",
            "fallback",
            "negative",
            "pad",
            "prefix",
            "range",
            "speak-as",
            "suffix",
            "symbols",
            "system",
          ],
          "@custom-media": [],
          "@document": [],
          "@font-face": [
            "@font-face",
            "ascent-override",
            "descent-override",
            "font-display",
            "font-family",
            "font-feature-settings",
            "font-stretch",
            "font-style",
            "font-variation-settings",
            "font-weight",
            "line-gap-override",
            "size-adjust",
            "src",
            "unicode-range",
          ],
          "@font-feature-values": [
            "@character-variant",
            "@font-feature-values",
            "@ornaments",
            "@styleset",
            "@stylistic",
            "@swash",
          ],
          "@font-palette-values": [
            "@font-palette-values",
            "base-palette",
            "font-family",
            "override-colors",
          ],
          "@function": [
            "@function",
            "result",
          ],
          "@import": [
            "@import",
          ],
          "@keyframes": [
            "@keyframes",
            "opacity",
          ],
          "@layer": [
            "@layer",
            "color",
          ],
          "@media": [
            "@media",
            "color",
          ],
          "@page": [
            "@page",
            "page-orientation",
            "size",
          ],
          "@position-try": [
            "@position-try",
            "margin",
            "position-area",
          ],
          "@property": [
            "@property",
            "inherits",
            "initial-value",
            "syntax",
          ],
          "@scope": [
            "@scope",
            "color",
          ],
          "@starting-style": [
            "@starting-style",
            "opacity",
          ],
          "@supports": [
            "@supports",
            "color",
          ],
        }
      `)

      await Fs.mkdir('test-results', { recursive: true })
      await Fs.writeFile(
        'test-results/at-rule-target-retention.json',
        JSON.stringify(
          {
            browser: browser.version(),
            evidence:
              'CSSOM retention only; this report does not establish complete rendering.',
            rules: report,
          },
          null,
          2,
        ),
      )
    } finally {
      await browser.close()
    }
  }, 30_000)
})
