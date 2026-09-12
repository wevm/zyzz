/** Exercises Svelte through its real compiler, renderer, and Vite lifecycle. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/Svelte.js'

describe('zyzz', () => {
  test('Svelte types, SSR, hydration, updates, themes, CSS edits, and production', async () => {
    const app = await Framework.create({
      ...Fixture.options,
      files: Fixture.files,
    })

    try {
      await Framework.verify(app)
    } finally {
      await app.close()
    }
  }, 240000)

  test('Svelte script blocks author styles through the Vite adapter', async () => {
    const app = await Framework.create({
      ...Fixture.options,
      edited: 'App.svelte',
      files: Fixture.inlineFiles,
    })

    try {
      await Framework.verify(app)
    } finally {
      await app.close()
    }
  }, 240000)

  test('Svelte recovers from renamed, removed, and recreated style modules', async () => {
    const app = await Framework.create({
      ...Fixture.options,
      files: Fixture.files,
    })

    try {
      // Svelte's HMR accept callback reads `module.default` from the failed
      // update, which Vite delivers as undefined; the page stays usable.
      expect(await Framework.recover(app)).toMatchInlineSnapshot(`
        [
          "Cannot read properties of undefined (reading 'default')",
        ]
      `)
    } finally {
      await app.close()
    }
  }, 240000)

  test('packed Svelte consumers render library styles through SSR, hydration, and production', async () => {
    const app = await Framework.create({
      ...Fixture.options,
      files: Fixture.packedFiles,
      library: true,
    })

    try {
      await Framework.verify(app)
    } finally {
      await app.close()
    }
  }, 240000)
})
