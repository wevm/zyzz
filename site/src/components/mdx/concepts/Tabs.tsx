/** Groups concepts source files and rendered examples in accessible tabs. @module */
import {
  Children,
  isValidElement,
  type ReactNode,
  useId,
  useState,
} from 'react'
import { style } from 'zyzz/default'

/** Displays one source file or rendered example at a time. */
export function Tabs(props: Tabs.Props) {
  const id = useId()
  const [selected, setSelected] = useState(0)
  const tabs = Children.toArray(props.children).filter(
    isValidElement<Tab.Props>,
  )

  return (
    <div data-concept-tabs="" {...styles.root()}>
      <div role="tablist" aria-label={props.label} {...styles.list()}>
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${id}-panel-${index}`}
            aria-selected={selected === index}
            id={`${id}-tab-${index}`}
            key={tab.key}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const next = (() => {
                if (event.key === 'ArrowRight') return (index + 1) % tabs.length
                if (event.key === 'ArrowLeft')
                  return (index - 1 + tabs.length) % tabs.length
                if (event.key === 'Home') return 0
                if (event.key === 'End') return tabs.length - 1
                return undefined
              })()
              if (next === undefined) return

              event.preventDefault()
              setSelected(next)
              document.getElementById(`${id}-tab-${next}`)?.focus()
            }}
            role="tab"
            tabIndex={selected === index ? 0 : -1}
            type="button"
            {...styles.tab()}
          >
            {tab.props.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          aria-labelledby={`${id}-tab-${index}`}
          hidden={selected !== index}
          id={`${id}-panel-${index}`}
          key={tab.key}
          role="tabpanel"
          tabIndex={0}
          {...styles.panel()}
        >
          {tab}
        </div>
      ))}
    </div>
  )
}

export declare namespace Tabs {
  /** Properties for a concepts example group. */
  type Props = {
    /** Source and render panels. */
    children: ReactNode
    /** Accessible name describing the example. */
    label: string
  }
}

/** Supplies one titled panel to a concepts example group. */
export function Tab(props: Tab.Props) {
  return props.children
}

export declare namespace Tab {
  /** Properties for one panel. */
  type Props = {
    /** Source code or a rendered example. */
    children: ReactNode
    /** Filename or render label. */
    title: string
  }
}

namespace styles {
  export const list = style({
    backgroundColor: 'gray.100',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    gap: 1,
    overflowX: 'auto',
    paddingInline: 2,
  })

  export const panel = style({
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '-2px',
    },
  })

  export const root = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginBlock: 6,
    overflow: 'hidden',
    '&[data-concept-tabs] [role="tabpanel"] > div:has(> pre)': {
      border: 'none',
      borderRadius: '0px !custom',
      margin: 0,
    },
    '&[data-concept-tabs] [data-concept-example]': {
      border: 'none',
      borderRadius: '0px !custom',
      margin: 0,
      minHeight: '180px !custom',
    },
  })

  export const tab = style({
    backgroundColor: 'transparent !custom',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'gray.900',
    cursor: 'pointer',
    flexShrink: 0,
    paddingBlock: 3,
    paddingInline: 3,
    typography: 'label.14',
    whiteSpace: 'nowrap',
    '&[aria-selected="true"]': {
      borderBottomColor: 'foreground',
      color: 'foreground',
    },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '-2px',
    },
  })
}
