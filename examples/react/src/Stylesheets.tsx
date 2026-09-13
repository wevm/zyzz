/** Demonstrates named stylesheet references and print output. @module */
import { counterStyle, fontFace, page, viewTransition } from 'zyzz/web'
import { css } from './zyzz.config.js'

const steps = counterStyle({
  suffix: '" "',
  symbols: '"◉" "○"',
  system: 'cyclic',
})

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'Playground Mono',
  src: 'local("Courier New")',
})
page({
  descriptors: {
    margin: '1.5cm',
    size: 'A4',
    '@bottom-center': { content: 'counter(page)' },
  },
})
viewTransition({ navigation: 'auto' })

namespace styles {
  export const button = css({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: '700' },
  })

  export const section = css({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const list = css({
    fontFamily: '"Playground Mono", monospace',
    listStyleType: steps,
    paddingLeft: 'lg',
  })
}

/** Opens native print preview for the authored page rule. */
export function Stylesheets() {
  return (
    <section {...styles.section()}>
      <h2>Stylesheet rules</h2>
      <ol {...styles.list()}>
        <li>Named counter style</li>
        <li>Local font face</li>
        <li>Page and margin boxes</li>
      </ol>
      <button {...styles.button()} onClick={() => window.print()}>
        Print preview
      </button>
      <p {...styles.muted()}>
        Global rules and ordered layers are shared by the app. The optional
        reset is an explicit import. View transitions are enabled for supporting
        cross-document navigations.
      </p>
    </section>
  )
}
