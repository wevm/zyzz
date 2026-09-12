/** Exercises compiled cross-document transitions over real same-origin navigation. @module */
import * as Http from 'node:http'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('compile', () => {
  test('captures navigation, activates declared types, and obeys conditional opt-out', async () => {
    const library = Graph.compile({
      modules: {
        'transitions.ts': `import {viewTransition} from 'zyzz/web';
viewTransition({navigation:'auto',types:'slide forward'});
viewTransition({navigation:'none'},{within:['@media (width < 500px)']});`,
      },
    })
    const packed = Graph.compile({
      contracts: { 'lib.js': library.contracts['transitions.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })
    const server = Http.createServer((request, response) => {
      const native = request.url?.startsWith('/native')
      const css = native
        ? '@view-transition{navigation:auto;types:slide forward}@media(width < 500px){@view-transition{navigation:none}}'
        : packed.sharedCss!
      response.setHeader('Content-Type', 'text/html')
      response.end(`<!doctype html><style>${css}
::view-transition-group(root){animation-duration:1s}
</style><script>
addEventListener('pagereveal', event => {
  const transition = event.viewTransition;
  if (!transition) {
    document.documentElement.dataset.capture = 'none';
    return;
  }
  transition.ready.then(() => {
    document.documentElement.dataset.capture = JSON.stringify({
      active: document.documentElement.matches(':active-view-transition'),
      forward: document.documentElement.matches(':active-view-transition-type(forward)'),
      image: getComputedStyle(document.documentElement, '::view-transition-new(root)').animationName !== 'none',
      types: [...transition.types].sort(),
    });
  }, error => { document.documentElement.dataset.capture = error.name; });
});
</script><a href="${native ? '/native' : '/compiled'}/next">Next</a><p>${request.url?.endsWith('/next') ? 'New page' : 'Old page'}</p>`)
    })
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    const browser = await chromium.launch(
      executablePath ? { executablePath } : {},
    )
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Expected a TCP listener.')

      for (const width of [800, 400]) {
        for (const route of ['compiled', 'native']) {
          const page = await browser.newPage({
            viewport: { height: 600, width },
          })
          try {
            await page.goto(`http://127.0.0.1:${address.port}/${route}`)
            await page.locator('a').click()
            await page.waitForURL(`**/${route}/next`)
            await page.waitForFunction(
              () => document.documentElement.dataset.capture !== undefined,
            )
            const capture = await page.evaluate(
              () => document.documentElement.dataset.capture,
            )

            if (width === 800)
              expect(JSON.parse(capture!)).toMatchInlineSnapshot(`
                {
                  "active": true,
                  "forward": true,
                  "image": true,
                  "types": [
                    "forward",
                    "slide",
                  ],
                }
              `)
            else expect(capture).toMatchInlineSnapshot('"none"')
          } finally {
            await page.close()
          }
        }
      }
    } finally {
      await browser.close()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
