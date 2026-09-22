/** Binds shared vars, property groups, and scoped alternatives to authoring. @module */
import type * as Shorthands from './internal/Shorthands.js'
import * as Configuration from './internal/Configuration.js'

export { InvalidError } from './internal/Configuration.js'
export type {
  Body,
  StyleFactory,
  VariableConfig,
  VariableOptions,
  VariableScope,
} from './internal/Configuration.js'

/** Creates isolated authoring with optional vars and named alternatives. */
export function create<const options extends create.Options = {}>(
  options: options &
    NoInfer<
      options extends Configuration.VariableOptions
        ? Configuration.VariableValidation<options>
        : Record<Exclude<keyof options, keyof create.Options>, never> &
            (options extends { shorthands: infer map extends Shorthands.Map }
              ? { shorthands: Shorthands.Validated<map> }
              : {})
    > = {} as never,
): create.ReturnType<options> {
  for (const key of ['theme', 'themes', 'defaultTheme'])
    if (Object.hasOwn(options, key))
      throw new Configuration.InvalidError(
        `Use vars and defaultVars instead of ${key}.`,
      )
  if (Object.hasOwn(options, 'mappings'))
    throw new Configuration.InvalidError(
      'Use propertyGroups instead of mappings.',
    )
  return Configuration.create(
    options as Configuration.VariableOptions,
  ) as create.ReturnType<options>
}

/** Configuration input and inferred helpers. */
export declare namespace create {
  /** Variable sets and optional authoring settings. */
  type Options =
    | Configuration.VariableOptions
    | Omit<
        Configuration.VariableOptions,
        'vars' | 'defaultVars' | 'propertyGroups'
      >
  /** Typed helpers selected by the supplied variable contract. */
  type ReturnType<options extends Options = Options> =
    options extends Configuration.VariableOptions
      ? Configuration.VariableConfig<options>
      : Configuration.create.ReturnType<
          Extract<options, Configuration.create.Options>
        >
}
