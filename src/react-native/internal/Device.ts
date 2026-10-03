/** Supplies automatic window measurements for native React consumers. @module */
import type * as Config from '../../Config.js'
import * as React from 'react'
import * as ReactNative from 'react-native'
import * as Subscription from '../react.js'
import * as Viewport from './Viewport.js'

/** Creates native authoring helpers and a Provider with automatic window subscriptions. */
export function defineConfig<const options extends Config.create.Options = {}>(
  options: options & Parameters<typeof Config.create<options>>[0] = {} as never,
): Subscription.defineConfig.ReturnType<options> {
  const config = Subscription.defineConfig<options>(options)
  return Object.freeze({
    ...config,
    Provider: dimensions(config.Provider),
  }) as Subscription.defineConfig.ReturnType<options>
}

/** Provides selected variables, appearance, and automatic native dimensions. */
export const Provider = dimensions(Subscription.Provider)

export { useStyles, useVars } from '../react.js'

function dimensions<props extends Subscription.Provider.Props>(
  Component: React.FunctionComponent<props>,
): React.FunctionComponent<props> {
  return function WindowProvider(props: props) {
    const window = ReactNative.useWindowDimensions()
    const viewport = React.useMemo(
      () => ({ height: window.height, width: window.width }),
      [window.height, window.width],
    )
    return React.createElement(
      Viewport.context.Provider,
      { value: viewport },
      React.createElement(Component, props),
    )
  }
}
