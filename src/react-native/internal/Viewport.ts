/** Connects the native device adapter to framework subscriptions. @module */
import type * as NativeContext from '../../runtime/NativeContext.js'
import type * as Media from '../../runtime/internal/NativeMedia.js'
import * as React from 'react'

/** Window measurements owned by the native Provider lifecycle. */
export const context = React.createContext<Media.Viewport | undefined>(
  undefined,
)

/** Device appearance for `colorScheme: 'system'`, with the platform's appearance-following color when it has one. */
export const appearance = React.createContext<{
  readonly adaptive?: NativeContext.Context['adaptive']
  readonly colorScheme: 'dark' | 'light'
}>({ colorScheme: 'light' })
