/** Renders the site home page. @module */
import { style } from './zyzz.config.js'

/** Displays the site heading. */
export function App() {
  return (
    <main {...styles.page()}>
      <h1 {...styles.heading()}>Zyzz</h1>
    </main>
  )
}

namespace styles {
  export const heading = style({
    fontSize: '2rem',
    fontWeight: 700,
    marginBlock: '0.67em',
  })

  export const page = style({
    margin: '4rem auto',
    width: 'min(42rem, calc(100% - 2rem))',
  })
}
