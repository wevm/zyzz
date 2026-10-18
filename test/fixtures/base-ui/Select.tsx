/** Renders real Select states with compiled, configured Base UI styles. @module */
import { Select } from '@base-ui/react/select'
import { createRoot } from 'react-dom/client'
import { style } from './Config.js'

/** Mounts a keyboard- and pointer-accessible Select example. */
export function mount(element: HTMLElement) {
  createRoot(element).render(<Example />)
}

function Example() {
  return (
    <main {...styles.page()}>
      <h1>Base UI states</h1>
      <p>Component-aware styles, ordinary Base UI elements.</p>
      <Select.Root defaultValue="apple">
        <Select.Trigger aria-label="Fruit" {...styles.trigger()}>
          <Select.Value />
          <Select.Icon>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            alignItemWithTrigger={false}
            side="bottom"
            sideOffset={8}
          >
            <Select.Popup data-testid="popup" {...styles.popup()}>
              <Select.List>
                <Select.Item value="apple" {...styles.item()}>
                  Apple
                </Select.Item>
                <Select.Item value="banana" {...styles.item()}>
                  Banana
                </Select.Item>
                <Select.Item value="cherry" disabled {...styles.item()}>
                  Cherry
                </Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </main>
  )
}

namespace styles {
  export const page = style(
    {
      color: 'ink',
      fontFamily: 'sans-serif',
      padding: '32px !custom',
    },
    { id: 'page' },
  )

  export const trigger = style(
    Select.Trigger,
    {
      backgroundColor: 'surface',
      border: '1px solid #94a3b8',
      borderRadius: '8px',
      color: 'ink',
      display: 'flex',
      gap: 'gap',
      justifyContent: 'space-between',
      padding: 'control',
      width: '220px !custom',
      states: { popupOpen: { borderColor: 'selected' } },
    },
    { id: 'trigger' },
  )

  export const popup = style(
    Select.Popup,
    {
      backgroundColor: 'surface',
      border: '1px solid #94a3b8',
      borderRadius: '8px',
      fontFamily: 'sans-serif',
      padding: '4px !custom',
      width: '210px !custom',
      states: {
        side: {
          bottom: { paddingTop: '12px !custom' },
          top: { paddingBottom: '16px !custom' },
        },
      },
    },
    { id: 'popup' },
  )

  export const item = style(
    Select.Item,
    {
      borderRadius: '4px',
      color: 'ink',
      cursor: 'default',
      padding: 'control',
      px: 'control',
      // Both conditions match a highlighted item. The later selector wins.
      states: {
        disabled: { opacity: 0.4 },
        highlighted: { backgroundColor: 'selected' },
        selected: { color: 'selected', fontWeight: 700 },
      },
      selectors: { '&[data-highlighted]': { backgroundColor: 'highlight' } },
    },
    { id: 'item' },
  )
}
