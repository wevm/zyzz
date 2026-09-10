/**
 * Runs a production React workload without a development test renderer.
 * @module
 */
import * as React from 'react'
import * as ReactDom from 'react-dom/client'
import type * as Runtime from './Runtime.js'

/** Raw browser measurements, in milliseconds per component batch. */
export type Sample = {
  /** Scheduling through React's layout-effect commit checkpoint. */
  commit: number
  /** Commit plus the following forced style/layout read. */
  commitLayout: number
  /** Scheduling through two animation frames; not paint CPU time. */
  frame: number
  /** Operation performed on the component tree. */
  operation: 'mount' | 'remount' | 'update'
}

/** Creates an isolated production workload; compilation and loading are excluded. */
export function create(options: create.Options) {
  const container = document.getElementById('app')!
  let root: ReactDom.Root | undefined
  let complete = () => {}
  let previous: Element | null = null

  function Tree({ phase }: { phase: number }) {
    React.useLayoutEffect(() => complete())
    return React.createElement(
      'main',
      null,
      Array.from({ length: options.components }, (_, index) =>
        React.createElement(
          'article',
          {
            ...options.apply(
              (index + phase) % options.literals.length,
              options.inputs[phase]!,
            ),
            key: index,
          },
          React.createElement('h2', null, `Card ${index}`),
          React.createElement('p', null, `Phase ${phase}`),
        ),
      ),
    )
  }

  async function render(phase: number, fresh: boolean) {
    const start = performance.now()
    if (fresh) root = ReactDom.createRoot(container)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('React commit timed out')),
        10000,
      )
      complete = () => {
        clearTimeout(timeout)
        resolve()
      }
      root!.render(React.createElement(Tree, { phase }))
    })
    const commit = performance.now() - start
    container.lastElementChild!.lastElementChild!.getBoundingClientRect()
    const commitLayout = performance.now() - start
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    return { commit, commitLayout, frame: performance.now() - start }
  }

  function verify(phase: number) {
    const cards = container.querySelectorAll('article')
    if (cards.length !== options.components)
      throw new Error('Incorrect card count')
    // Match the full grid, including fractional tracks and intrinsic content.
    // Prepare all controls before reading layout to avoid one layout per card.
    const control = container.firstElementChild!.cloneNode(true) as HTMLElement
    const references = control.querySelectorAll('article')
    const input = options.inputs[phase]!
    for (const [index, reference] of references.entries()) {
      reference.removeAttribute('class')
      reference.removeAttribute('style')
      Object.assign(
        reference.style,
        options.literals[(index + phase) % options.literals.length]!,
        options.kind === 'callable' ? {} : input.style,
        options.kind === 'dynamic'
          ? { width: input.width, opacity: input.alpha }
          : {},
      )
    }
    container.append(control)
    try {
      for (const [index, card] of cards.entries()) {
        const literal =
          options.literals[(index + phase) % options.literals.length]!
        const reference = references[index]!
        const actualStyle = getComputedStyle(card)
        const expectedStyle = getComputedStyle(reference)
        for (const key of new Set([
          ...Object.keys(literal),
          ...Object.keys(input.style ?? {}),
          'width',
          'opacity',
        ])) {
          const property = key.replace(
            /[A-Z]/g,
            (letter) => `-${letter.toLowerCase()}`,
          )
          if (
            actualStyle.getPropertyValue(property) !==
            expectedStyle.getPropertyValue(property)
          )
            throw new Error(
              `Card ${index}: ${property} differs (${actualStyle.getPropertyValue(property)} versus ${expectedStyle.getPropertyValue(property)})`,
            )
        }
        if (card.textContent !== `Card ${index}Phase ${phase}`)
          throw new Error('Incorrect card content')
        if (
          options.kind !== 'callable' &&
          input.className &&
          !card.classList.contains(input.className)
        )
          throw new Error('Missing external class')
      }
    } finally {
      control.remove()
      container.getBoundingClientRect()
    }
  }

  return {
    async cycle(): Promise<readonly Sample[]> {
      root?.unmount()
      root = undefined
      container.getBoundingClientRect()
      const mount = await render(0, true)
      verify(0)
      previous = container.querySelector('article')
      const update = await render(1, false)
      if (previous !== container.querySelector('article'))
        throw new Error('Update replaced DOM')
      verify(1)
      // Removal is outside remount timing. The existing React root is retained.
      await new Promise<void>((resolve) => {
        function Empty() {
          React.useLayoutEffect(resolve, [])
          return null
        }
        root!.render(React.createElement(Empty))
      })
      container.getBoundingClientRect()
      const remount = await render(0, false)
      if (previous === container.querySelector('article'))
        throw new Error('Remount reused DOM')
      verify(0)
      return [
        { ...mount, operation: 'mount' },
        { ...update, operation: 'update' },
        { ...remount, operation: 'remount' },
      ]
    },
    dispose() {
      root?.unmount()
      root = undefined
    },
  }
}

/** Production workload inputs, shared by every framework. */
export declare namespace create {
  /** Compiled application and independent expected declarations. */
  type Options = {
    /** Official compiled framework application. */
    apply: Runtime.Bundle['apply']
    /** Number of rendered cards. */
    components: number
    /** Alternate class and inline-style inputs. */
    inputs: readonly Runtime.Input[]
    /** Application workload. */
    kind: 'callable' | 'dynamic' | 'overrides'
    /** Native declarations used only for untimed correctness checks. */
    literals: readonly Record<string, string | number>[]
  }
}
