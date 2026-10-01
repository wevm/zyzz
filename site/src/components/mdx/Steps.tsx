/** Turns Markdown headings and content into ordered setup steps. @module */
import { Children, isValidElement, type ReactNode } from 'react'
import { style } from '../../zyzz.config.js'

/** Groups each level-three heading and its following content into a step. */
export function Steps(input: Steps.Props) {
  const { children, start = 1 } = input

  type Step = { content: ReactNode[]; title: ReactNode }
  const steps: Step[] = []
  for (const child of Children.toArray(children)) {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === 'h3')
      steps.push({ title: child.props.children, content: [] })
    else steps.at(-1)?.content.push(child)
  }

  return (
    <ol start={start} data-steps="" {...styles.steps()}>
      {steps.map((step, index) => (
        <li data-step="" key={index} {...styles.step()}>
          <span aria-hidden="true" {...styles.number()}>
            {index + start}
          </span>
          <div {...styles.content()}>
            <h3 {...styles.title()}>{step.title}</h3>
            {step.content}
          </div>
        </li>
      ))}
    </ol>
  )
}

export declare namespace Steps {
  /** Properties for the Steps component. */
  type Props = {
    children: ReactNode
    start?: number
  }
}

namespace styles {
  export const content = style({ minWidth: 0, paddingBottom: 6 })

  export const number = style({
    typography: 'label.13',
    alignItems: 'center',
    backgroundColor: 'gray.200',
    color: 'gray.900',
    borderRadius: '9999px !custom',
    display: 'flex',
    height: 7,
    justifyContent: 'center',
    position: 'relative',
    width: 7,
    zIndex: 1,
  })

  export const step = style({
    display: 'grid',
    gap: 4,
    gridTemplateColumns: '28px minmax(0, 1fr)',
    position: 'relative',
    '&::before': {
      borderLeft: '1px dashed',
      borderColor: 'gray.400',
      content: '"" !custom',
      position: 'absolute',
      left: '14px !custom',
      top: 8,
      bottom: 0,
    },
  })

  export const steps = style({
    listStyleType: 'none',
    marginBlock: 6,
    padding: 0,
  })

  export const title = style({ typography: 'heading.20' })
}
