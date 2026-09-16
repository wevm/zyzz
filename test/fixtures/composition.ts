/** Defines composition projects from the shared compiler and browser corpus. @module */
import * as Corpus from '../../bench/Corpus.js'

/** Small, repeated, mostly unique, and component integration workloads. */
export const cases = Corpus.cases.filter((entry) =>
  ['small', 'repeated', 'unique', 'components'].includes(entry.name),
)

/** Creates ordinary source authoring for a complete corpus workload. */
export function source(options: source.Options) {
  const styles = Corpus.styles(options.workload)
  const declarations = styles
    .map(
      (style, index) =>
        `export const item${index} = style(${JSON.stringify(style)});`,
    )
    .join('\n')
  const bindings = options.binding
    ? styles
        .map((_, index) => `const props${index} = styles.item${index}();`)
        .join('\n')
    : ''
  const applications = styles
    .map(
      (_, index) =>
        `cx(${options.binding ? `props${index}` : `styles.item${index}()`}, ${options.conditional ? 'enabled && ' : ''}styles.override())`,
    )
    .join(',\n')

  return `import { Config, cx } from 'zyzz';
const { style } = Config.create({ output: '${options.output}' });
namespace styles {
${declarations}
export const override = style({paddingLeft:'3px',color:'rebeccapurple','@media (width >= 600px)':{paddingRight:'5px'}});
}
export function apply(enabled = true) {
${bindings}
return [${applications}];
}`
}

/** Inputs shared by integration verification and measurements. */
export declare namespace source {
  /** Matched source distribution and composition form. */
  type Options = {
    /** Retain immutable application bindings instead of direct arguments. */
    readonly binding: boolean
    /** Toggle the override with a runtime presence condition. */
    readonly conditional: boolean
    /** Native props shape used by the consumer. */
    readonly output: 'html' | 'react'
    /** Existing integration corpus distribution and project size. */
    readonly workload: Corpus.Case
  }
}
