import type { Style } from 'typestyle'

/** Shared consumer input. Authored order is intentional: integration scenarios verify declaration and style order. */
export const components = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    paddingLeft: 0,
    marginTop: '-2px',
    width: '100%',
    maxWidth: '40rem',
    backgroundColor: '#fff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#0003',
    borderRadius: '0.5rem',
  },
  label: {
    color: 'currentColor',
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
    textAlign: 'start',
    opacity: 0.8,
  },
  hidden: { display: 'none' },
} as const satisfies Record<string, Style.Properties>

/** Creates repeated or mostly unique real definition inputs outside timed work. */
export function project(
  count: number,
  unique: boolean,
): Record<string, Style.Properties> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `card${i}`,
      { ...components.card, padding: unique ? `${i}px` : '1rem' },
    ]),
  )
}
