/** Exercises Solid through its real compiler, renderer, and Vite lifecycle. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/Solid.js'

describe('zyzz', () => {
  test('Solid types, SSR, hydration, signals, themes, CSS edits, and production', async () => {
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

  test('Solid recovers from renamed, removed, and recreated style modules', async () => {
    const app = await Framework.create({
      ...Fixture.options,
      files: Fixture.files,
    })

    try {
      expect(await Framework.recover(app)).toMatchInlineSnapshot(`[]`)
    } finally {
      await app.close()
    }
  }, 240000)

  test('packed Solid consumers render library styles through SSR, hydration, and production', async () => {
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
