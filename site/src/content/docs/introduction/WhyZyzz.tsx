/** Illustrates the authoring and compilation boundaries on Why Zyzz. @module */
import { style } from '../../../zyzz.config.js'

/** Displays explicit inputs, typed definitions, and target-specific output. */
export function CompilationFlow() {
  return (
    <div aria-label="Zyzz authoring and compilation" {...styles.diagram()}>
      <div {...styles.flow()}>
        <div {...styles.stage()}>
          <span {...styles.eyebrow()}>01 / Define</span>
          <svg aria-hidden="true" viewBox="0 0 180 104" {...styles.art()}>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="18" y="16" width="144" height="72" rx="8" />
              <path d="M18 40h144M66 40v48" />
              <circle cx="31" cy="28" r="2" />
              <circle cx="40" cy="28" r="2" />
              <path d="M82 56h58M82 72h38" />
            </g>
            <rect
              x="32"
              y="53"
              width="20"
              height="20"
              rx="5"
              fill="currentColor"
              {...styles.accent()}
            />
          </svg>
          <strong>Explicit design decisions</strong>
          <span>CSS values, optional tokens, and layers.</span>
        </div>
        <svg aria-hidden="true" viewBox="0 0 24 24" {...styles.arrow()}>
          <path
            d="M3 12h18m-6-6 6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <div {...styles.stage()}>
          <span {...styles.eyebrow()}>02 / Author</span>
          <svg aria-hidden="true" viewBox="0 0 180 104" {...styles.art()}>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="18" y="16" width="144" height="72" rx="8" />
              <path d="M43 36c-7 0-7 5-7 9s-2 7-6 7c4 0 6 3 6 7s0 9 7 9m94-32c7 0 7 5 7 9s2 7 6 7c-4 0-6 3-6 7s0 9-7 9M57 38h43M57 52h66M57 66h31" />
            </g>
            <path
              d="m107 70 5 5 11-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              {...styles.accent()}
            />
          </svg>
          <strong>Typed component styles</strong>
          <span>Properties, token paths, and variant choices.</span>
        </div>
        <svg aria-hidden="true" viewBox="0 0 24 24" {...styles.arrow()}>
          <path
            d="M3 12h18m-6-6 6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <div {...styles.stage()}>
          <span {...styles.eyebrow()}>03 / Compile</span>
          <svg aria-hidden="true" viewBox="0 0 180 104" {...styles.art()}>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M90 14v17M45 42v-11h90v11" />
              <rect x="18" y="42" width="64" height="40" rx="5" />
              <path d="M50 82v8M36 90h28M29 55h22M29 65h38" />
              <rect x="110" y="42" width="32" height="48" rx="5" />
              <path d="M118 55h16M118 65h16M118 75h10" />
            </g>
            <circle
              cx="90"
              cy="14"
              r="4"
              fill="currentColor"
              {...styles.accent()}
            />
          </svg>
          <strong>Platform output</strong>
          <span>
            Web CSS or native tables, within each target's capabilities.
          </span>
        </div>
      </div>
      <div {...styles.runtime()}>
        <span {...styles.eyebrow()}>At render time</span>
        <span>Apply compiled styles. Select alternatives. Bind values.</span>
      </div>
    </div>
  )
}

namespace styles {
  export const accent = style({ color: 'blue.900' })

  export const arrow = style({
    alignSelf: 'center',
    color: 'gray.700',
    height: 6,
    width: 6,
    '@media (max-width: 639px)': { transform: 'rotate(90deg)' },
  })

  export const art = style({
    color: 'gray.900',
    height: '104px !custom',
    marginBlock: 2,
    maxWidth: '100% !custom',
    width: '180px !custom',
  })

  export const diagram = style({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    marginBlock: 6,
    overflow: 'hidden',
  })

  export const eyebrow = style({
    typography: 'label.12.mono',
    color: 'gray.900',
  })

  export const flow = style({
    alignItems: 'start',
    display: 'grid',
    gap: 2,
    gridTemplateColumns: '1fr auto 1fr auto 1fr',
    padding: 6,
    '@media (max-width: 639px)': {
      gridTemplateColumns: '1fr',
      justifyItems: 'center',
      padding: 4,
    },
  })

  export const runtime = style({
    typography: 'copy.14',
    backgroundColor: 'gray.100',
    borderTop: '1px solid',
    borderColor: 'gray.400',
    color: 'gray.900',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
    paddingBlock: 4,
    paddingInline: 6,
  })

  export const stage = style({
    typography: 'copy.14',
    alignItems: 'center',
    color: 'gray.900',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    textAlign: 'center',
    '& strong': { typography: 'label.14', color: 'foreground' },
  })
}
