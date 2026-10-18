/** Renders numeric, string, inherited, and child-targeted Base UI states. @module */
import { Accordion } from '@base-ui/react/accordion'
import { Fieldset } from '@base-ui/react/fieldset'
import { Popover } from '@base-ui/react/popover'
import { Slider } from '@base-ui/react/slider'
import { Toast } from '@base-ui/react/toast'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { style } from 'zyzz/base-ui/react'

/** Mounts the real components without replacing their state or attribute handling. */
export function mount(element: HTMLElement) {
  createRoot(element).render(<Example />)
}

function Example() {
  return (
    <main {...styles.page()}>
      <h1>Base UI attribute coverage</h1>
      <Accordion.Root defaultValue={['first']}>
        {['first', 'second'].map((value) => (
          <Accordion.Item
            key={value}
            value={value}
            data-testid={value}
            {...styles.item()}
          >
            <Accordion.Header>
              <Accordion.Trigger>{value}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Accordion content</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <Fieldset.Root disabled data-testid="disabled" {...styles.fieldset()}>
        <Fieldset.Legend>Disabled fieldset</Fieldset.Legend>
      </Fieldset.Root>
      <Fieldset.Root data-testid="enabled" {...styles.fieldset()}>
        <Fieldset.Legend>Enabled fieldset</Fieldset.Legend>
      </Fieldset.Root>
      <Slider.Root defaultValue={[20, 70]}>
        <Slider.Control {...styles.control()}>
          <Slider.Track />
          <Slider.Thumb aria-label="Lower" {...styles.thumb()} />
          <Slider.Thumb aria-label="Upper" {...styles.thumb()} />
        </Slider.Control>
      </Slider.Root>
      <Toast.Provider timeout={0}>
        <Notifications />
      </Toast.Provider>
      <Popover.Root defaultOpen>
        <Popover.Trigger>Popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Viewport data-testid="viewport" {...styles.viewport()}>
                <p>Current content</p>
              </Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </main>
  )
}

function Notifications() {
  const manager = Toast.useToastManager()
  useEffect(() => {
    manager.add({
      id: 'custom',
      title: 'Custom toast type',
      type: 'custom"\\\nA',
    })
    manager.add({ id: 'other', title: 'Other toast type', type: 'other' })
  }, [manager.add])

  return (
    <Toast.Viewport>
      {manager.toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          data-testid={toast.id}
          {...styles.toast()}
        >
          <Toast.Title />
        </Toast.Root>
      ))}
    </Toast.Viewport>
  )
}

namespace styles {
  export const page = style({ fontFamily: 'sans-serif', padding: '32px' })

  export const item = style(Accordion.Item, {
    states: {
      index: {
        0: { borderLeft: '4px solid red' },
        1: { borderLeft: '6px solid blue' },
      },
    },
  })

  export const fieldset = style(Fieldset.Root, {
    color: 'black',
    states: { disabled: { color: 'purple' } },
  })

  export const control = style(Slider.Control, {
    height: '24px',
    position: 'relative',
    width: '240px',
  })

  export const thumb = style(Slider.Thumb, {
    backgroundColor: 'gray',
    height: '16px',
    width: '16px',
    states: {
      index: { 0: { backgroundColor: 'red' }, 1: { backgroundColor: 'blue' } },
    },
  })

  export const toast = style(Toast.Root, {
    color: 'black',
    states: {
      type: { 'custom"\\\nA': { color: 'green' } },
      expanded: { borderTop: '3px solid blue' },
    },
  })

  export const viewport = style(Popover.Viewport, {
    borderLeft: '1px solid black',
    fontFamily: 'sans-serif',
    padding: '8px',
    states: {
      current: { borderLeft: '7px solid green' },
      previous: { borderLeft: '9px solid red' },
    },
  })
}
