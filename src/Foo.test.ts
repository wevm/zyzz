import { Foo } from 'typestyle'

describe('foo', () => {
  test('default', () => {
    expect(Foo.foo()).toBe('Hello, foo!')
  })
})
