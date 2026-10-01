/** Selects a compilation target and renders its authored setup steps. @module */
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { Card } from './Card.js'
import { Steps } from './Steps.js'

/** Presents framework cards before the selected target's setup steps. */
export function FrameworkSetup(input: FrameworkSetup.Props) {
  const { children } = input

  const targets = Children.toArray(children).flatMap((child) =>
    isValidElement<FrameworkSetup.Target.Props>(child) &&
    child.type === FrameworkSetup.Target
      ? [child.props]
      : [],
  )
  const navigate = useNavigate({ from: '/docs/$' })
  const search = useSearch({ from: '/docs/$' })
  const target =
    targets.find((target) => target.value === search.framework) ?? targets[0]
  const selected = target?.title
  const native = target?.value === 'react-native'
  const mode = native ? 'custom' : search.mode
  const steps = Children.toArray(target?.children).find(
    (child) =>
      isValidElement<ComponentProps<typeof Steps>>(child) &&
      child.type === Steps,
  )
  const content = isValidElement<ComponentProps<typeof Steps>>(steps)
    ? steps.props.children
    : null

  const focused = Children.toArray(content).flatMap((child) => {
    if (
      isValidElement<FrameworkSetup.Mode.Props>(child) &&
      child.type === FrameworkSetup.Mode
    )
      return child.props.name === mode
        ? Children.toArray(child.props.children)
        : []
    return [child]
  })

  return (
    <section id="framework-setup" aria-label={`${selected} setup`}>
      <Steps>
        {Children.toArray(children).flatMap((child) =>
          isValidElement<ComponentProps<typeof Steps>>(child) &&
          child.type === Steps
            ? Children.toArray(child.props.children)
            : [],
        )}
        <h3>Choose Framework</h3>
        <p>Choose a compilation target to see its setup steps.</p>
        <Card.Group>
          {targets.map((target) => (
            <Card
              key={target.title}
              title={target.title}
              icon={target.icon}
              selected={target.title === selected}
              onClick={() => {
                void navigate({
                  resetScroll: false,
                  search: (previous) => ({
                    ...previous,
                    framework: target.value,
                    mode:
                      target.value === 'react-native'
                        ? 'custom'
                        : previous.mode,
                  }),
                })
              }}
            >
              {target.description}
            </Card>
          ))}
        </Card.Group>
        <h3>Choose Mode</h3>
        <p>
          Use the bundled variables to start with an existing design system, or
          define variables for your own.
        </p>
        <Card.Group>
          <Card
            title="Default Variables (Quick)"
            icon="zap"
            selected={mode === 'default'}
            disabled={native}
            onClick={() => {
              void navigate({
                resetScroll: false,
                search: (previous) => ({ ...previous, mode: 'default' }),
              })
            }}
          >
            Use built-in colors, spacing, and typography when the bundled design
            system fits your project. No custom config is required.
          </Card>
          <Card
            title="Custom Variables (Advanced)"
            icon="sliders"
            selected={mode === 'custom'}
            onClick={() => {
              void navigate({
                resetScroll: false,
                search: (previous) => ({ ...previous, mode: 'custom' }),
              })
            }}
          >
            Define your own tokens for brand colors, spacing, and themes when
            your project needs a tailored design system.
          </Card>
        </Card.Group>
        {native && (
          <p>
            The Metro integration currently requires custom variables. Bundled
            default-theme imports are not supported.
          </p>
        )}
        {focused}
      </Steps>
    </section>
  )
}

export declare namespace FrameworkSetup {
  /** Properties for the FrameworkSetup component. */
  type Props = { children: ReactNode }
}

/** Authored setup content for a compilation target. */
export namespace FrameworkSetup {
  /** Declares setup content for the selected variable mode. */
  export function Mode(props: FrameworkSetup.Mode.Props) {
    const { children } = props

    return <>{children}</>
  }

  export declare namespace Mode {
    /** Properties for the Mode component. */
    type Props = { children: ReactNode; name: 'default' | 'custom' }
  }

  /** Declares a target's selector and focused setup steps. */
  export function Target(props: FrameworkSetup.Target.Props) {
    const { children } = props

    return <>{children}</>
  }

  export declare namespace Target {
    /** Properties for the Target component. */
    type Props = {
      children: ReactNode
      description: string
      icon: NonNullable<ComponentProps<typeof Card>['icon']>
      title: string
      value: string
    }
  }
}
