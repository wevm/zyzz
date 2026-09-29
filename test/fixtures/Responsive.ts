/** Shared responsive defaults exercised through compiler and adapter delivery. @module */
import { chromium } from 'playwright'
import { expect } from 'vite-plus/test'

/** Independent consumers with overlapping defaults and nested variable scopes. */
export const modules = {
  'config.js': `import {Config,Vars} from 'zyzz';const base=Vars.define({editorial:{labelSize:{default:'14px','@media (width >= 1024px)':'16px'},space:{default:'8px','@media (width >= 1024px)':'12px'}}});const large=Vars.extend(base,{editorial:{labelSize:{default:'20px','@media (width >= 1024px)':'24px'}}});export const {style,vars}=Config.create({vars:{base,large},defaultVars:'base',mappings:false});`,
  'entry.js': `import {vars} from './config.js';export {first} from './first.js';export {second} from './second.js';export const base=vars({set:'base'});export const large=vars({set:'large'});`,
  'first.js': `import {style} from './config.js';export const first=style({fontSize:'editorial.labelSize'})();`,
  'second.js': `import {style} from './config.js';export const second=style({fontSize:'editorial.labelSize',padding:'editorial.space'})();`,
}

/** Bundled fixture exports consumed by the browser. */
type Props = Record<
  'base' | 'first' | 'large' | 'second',
  { className: string }
>

/** Checks shared definitions and their computed values at both viewport sizes. */
export async function verify(options: verify.Options) {
  expect(
    [...options.css.matchAll(/:where\(\*\)\s*\{([^}]+)\}/g)].some(
      ([, declarations]) =>
        (declarations!.match(/--z-[\w-]+:/g)?.length ?? 0) > 1,
    ),
  ).toMatchInlineSnapshot('true')

  expect(
    options.css.match(/--z-editorial-labelSize-fallback-[\w-]+:\s*14px/g)
      ?.length,
  ).toMatchInlineSnapshot('1')
  expect(
    options.css.match(/--z-editorial-labelSize-fallback-[\w-]+:\s*20px/g)
      ?.length,
  ).toMatchInlineSnapshot('1')
  expect(
    options.css.match(/--z-editorial-space-fallback-[\w-]+:\s*8px/g)?.length,
  ).toMatchInlineSnapshot('1')

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { height: 600, width: 800 },
    })
    await page.setContent(`<style>${options.css}</style>`)
    await page.addScriptTag({ content: options.code })
    await page.evaluate(() => {
      const fixture = (window as typeof window & { Fixture: Props }).Fixture
      document.body.innerHTML = `<div class="${fixture.base.className}"><div id="first" class="${fixture.first.className}"></div><div class="${fixture.large.className}"><div id="second" class="${fixture.second.className}"></div></div></div>`
    })
    expect(
      await page
        .locator('#first')
        .evaluate((node) => getComputedStyle(node).fontSize),
    ).toMatchInlineSnapshot('"14px"')
    expect(
      await page
        .locator('#second')
        .evaluate((node) => getComputedStyle(node).fontSize),
    ).toMatchInlineSnapshot('"20px"')
    expect(
      await page
        .locator('#second')
        .evaluate((node) => getComputedStyle(node).padding),
    ).toMatchInlineSnapshot('"8px"')
    await page.setViewportSize({ height: 600, width: 1200 })
    expect(
      await page
        .locator('#first')
        .evaluate((node) => getComputedStyle(node).fontSize),
    ).toMatchInlineSnapshot('"16px"')
    expect(
      await page
        .locator('#second')
        .evaluate((node) => getComputedStyle(node).fontSize),
    ).toMatchInlineSnapshot('"24px"')
    expect(
      await page
        .locator('#second')
        .evaluate((node) => getComputedStyle(node).padding),
    ).toMatchInlineSnapshot('"12px"')
  } finally {
    await browser.close()
  }
}

export declare namespace verify {
  /** Complete artifacts emitted by an adapter. */
  type Options = {
    /** IIFE bundle exporting the fixture as `Fixture`. */
    code: string
    /** Stylesheets in their delivery order. */
    css: string
  }
}
