/** Exercises explicit CSS representations through the public compiler. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('defaults to atomic declarations and shares repeated properties', () => {
    const styles = Style.define({
      card: { color: 'red', padding: '8px' },
      label: { color: 'red' },
    })

    const output = Css.compile({ styles })
    const atomic = Css.compile({ cssOutput: 'atomic', styles })
    const grouped = Css.compile({ cssOutput: 'grouped', styles })

    expect(output).toEqual(atomic)
    expect(output.classes.card.split(' ')).toHaveLength(2)
    expect(output.classes.card.split(' ')).toContain(output.classes.label)
    expect(output.css.match(/color:red;/g)).toHaveLength(1)
    expect(grouped.classes.card.split(' ')).toHaveLength(1)
    expect(grouped.css).toContain('{color:red;padding:8px;}')
    expect(grouped.css.match(/color:red;/g)).toHaveLength(2)
    expect(Css.compile({ styles })).toEqual(output)
  })

  test('retains fallback sequences, importance, and stylesheet contributions', () => {
    const styles = Style.define({
      card: { display: ['block', 'grid!'], color: 'red' },
    })
    const contributions: readonly Css.Contribution[] = [
      {
        kind: 'rule',
        selector: 'body',
        style: Style.define({ body: { margin: 0 } }).styles[0]!,
      },
    ]

    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const output = Css.compile({ contributions, cssOutput, styles })

      expect(output.css).toContain('display:block;display:grid!important;')
      expect(output.contributionCss).toContain('body{margin:0;}')
      expect(output.css).toContain('color:red;')
    }
  })
})
