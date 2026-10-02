/** Connects the native device adapter to framework subscriptions. @module */
import type * as Media from '../../runtime/internal/NativeMedia.js'
import * as React from 'react'

/** Window measurements owned by the native Provider lifecycle. */
export const context = React.createContext<Media.Viewport | undefined>(
  undefined,
)
