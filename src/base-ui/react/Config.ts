/** Binds Base UI state authoring to the ordinary variable configuration. @module */
import * as Authoring from './internal/Authoring.js'
import * as Config from '../../Config.js'
import type * as Shorthands from '../../internal/Shorthands.js'
import type * as Style from './Style.js'
import type * as Vars from '../../Vars.js'

type Values<options> = options extends { vars: infer values }
  ? options extends { defaultVars: infer name extends keyof values }
    ? Vars.Extract<values[name]>
    : Vars.Extract<values>
  : {}

/**
 * Creates configured authoring with component-first Base UI styles.
 * The ordinary variable sets, layers, mappings, shorthands, and recipes are retained.
 * Output is React props. Component-first variants and callbacks are not supported.
 * Pass `tokens` from `zyzz/default` as `vars` to retain default token strings,
 * including inside component states. The unconfigured entrypoint stays token-free.
 * @example
 * ```ts
 * import { defineConfig } from 'zyzz/base-ui/react'
 * import { tokens } from 'zyzz/default'
 *
 * // Share default tokens with ordinary and component-first styles.
 * export const { style, variants, vars } = defineConfig({ id: 'default', vars: tokens })
 * ```
 * @param options - The ordinary defineConfig options, with React output.
 * @returns Configured helpers whose style also accepts imported Base UI parts.
 */
export function create<const options extends create.Options = {}>(
  options: Parameters<typeof Config.create<options>>[0] = {} as never,
): create.ReturnType<options> {
  if ((options as Config.create.Options)?.output === 'html')
    throw new Config.InvalidError(
      'Base UI configuration requires React output.',
    )

  const config = Config.create<options>(options)

  return {
    ...config,
    style: Authoring.bind(config.style as Authoring.bind.Factory),
  } as create.ReturnType<options>
}

/** Configured Base UI authoring contracts. */
export declare namespace create {
  /** Ordinary configuration constrained to React props. */
  type Options = Config.create.Options & {
    /** Base UI components consume React className and style props. */
    readonly output?: 'react' | undefined
  }
  /** Existing helpers with the component-first static style overload. */
  type ReturnType<options extends Options = {}> = Omit<
    Config.create.ReturnType<options>,
    'style'
  > & {
    /** Authors ordinary styles and component-aware static Base UI declarations. */
    readonly style: Config.create.ReturnType<options>['style'] &
      Style.Factory<
        Vars.Mapped<
          Values<options>,
          options extends { mappings: infer map } ? map : {}
        >,
        options extends { layers: readonly (infer layer extends string)[] }
          ? layer
          : never,
        options extends { shorthands: infer map extends Shorthands.Map }
          ? map
          : {}
      >
  }
}
