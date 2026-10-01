/** Illustrates the authoring flow for the Thinking in Zyzz page. @module */
import { style } from '../../zyzz.config.js'

/** Displays shared values flowing into local styles and component props. */
export function ThinkingDiagram() {
  return (
    <figure {...styles.figure()}>
      <div role="list" aria-label="Zyzz authoring flow" {...styles.grid()}>
        <div role="listitem" {...styles.card()}>
          <div {...styles.label()}>01 · Tokens</div>
          <svg aria-hidden="true" viewBox="0 0 240 84" {...styles.graphic()}>
            <path d="M24 24H216M24 60H216" stroke="currentColor" opacity=".2" />
            <circle cx="48" cy="24" r="9" fill="currentColor" />
            <circle cx="84" cy="24" r="9" fill="currentColor" opacity=".5" />
            <circle cx="120" cy="24" r="9" fill="currentColor" opacity=".25" />
            <path
              d="M39 52V68M39 60H63M63 52V68M87 52V68M87 60H135M135 52V68M159 52V68M159 60H207M207 52V68"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div {...styles.detail()}>Shared colors and spacing</div>
          <code {...styles.code()}>surface · comfortable</code>
        </div>
        <div role="listitem" {...styles.card()}>
          <div {...styles.label()}>02 · Config</div>
          <svg aria-hidden="true" viewBox="0 0 240 84" {...styles.graphic()}>
            <path
              d="M24 24H78L96 42M24 60H78L96 42M144 42H216"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="96"
              y="18"
              width="48"
              height="48"
              rx="12"
              fill="currentColor"
              opacity=".1"
            />
            <path
              d="M110 33L102 42L110 51M130 33L138 42L130 51M125 30L115 54M208 36L216 42L208 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div {...styles.detail()}>Bind a typed contract</div>
          <code {...styles.code()}>defineConfig({'{ vars }'})</code>
        </div>
        <div role="listitem" {...styles.card()}>
          <div {...styles.label()}>03 · Local styles</div>
          <svg aria-hidden="true" viewBox="0 0 240 84" {...styles.graphic()}>
            <rect
              x="24"
              y="8"
              width="192"
              height="68"
              rx="8"
              fill="currentColor"
              opacity=".08"
            />
            <path
              d="M24 26H216M38 41H106M38 55H148M38 65H122"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="37" cy="17" r="2" fill="currentColor" />
            <circle cx="46" cy="17" r="2" fill="currentColor" opacity=".5" />
            <path
              d="M181 40L173 48L181 56M195 40L203 48L195 56"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div {...styles.detail()}>Name each element's rules</div>
          <code {...styles.code()}>styles.card = style(...)</code>
        </div>
        <div role="listitem" {...styles.card()}>
          <div {...styles.label()}>04 · Components</div>
          <svg aria-hidden="true" viewBox="0 0 240 84" {...styles.graphic()}>
            <rect
              x="24"
              y="8"
              width="192"
              height="68"
              rx="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity=".4"
            />
            <path
              d="M40 25H108M40 37H154"
              stroke="currentColor"
              strokeWidth="3"
            />
            <rect
              x="40"
              y="50"
              width="56"
              height="14"
              rx="4"
              fill="currentColor"
            />
            <path
              d="M176 53L182 59L195 45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div {...styles.detail()}>Apply the generated props</div>
          <code {...styles.code()}>{'<article {...styles.card()}>'}</code>
        </div>
      </div>
      <figcaption {...styles.caption()}>
        Shared values → typed helpers → named styles → element props.
      </figcaption>
    </figure>
  )
}

namespace styles {
  export const caption = style({
    typography: 'copy.13',
    color: 'gray.900',
    marginTop: 4,
  })

  export const card = style({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    minWidth: '0 !custom',
    padding: 5,
  })

  export const code = style({
    typography: 'copy.13.mono',
    color: 'gray.900',
    display: 'block',
    marginTop: 1,
    overflowWrap: 'anywhere',
  })

  export const detail = style({ typography: 'label.14', color: 'foreground' })

  export const figure = style({ marginBlock: 6, marginInline: 0 })

  export const graphic = style({
    color: 'blue.900',
    display: 'block',
    height: '84px !custom',
    marginBlock: 4,
    width: '100% !custom',
  })

  export const grid = style({
    display: 'grid',
    gap: 3,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '@media (max-width: 479px)': { gridTemplateColumns: '1fr' },
  })

  export const label = style({
    typography: 'label.14',
    color: 'foreground',
    fontWeight: 'medium',
  })
}
