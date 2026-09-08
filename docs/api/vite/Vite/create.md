# Vite.create

> [!NOTE]
> Preview API; not yet implemented.

Connect source transformation and CSS delivery to Vite.

```ts
import { defineConfig } from 'vite'
import { Vite } from 'zyzz/vite'

export default defineConfig({ plugins: [Vite.create()] })
```

## Signature

`Vite.create()`

## Parameters

The proposed minimal setup takes no required arguments. Additional adapter options must be finalized against real integration fixtures.

## Returns

A Vite-compatible plugin for development updates and linked production CSS.

## Errors

Source/target errors must remain located; failed development builds preserve the previous complete output.

The adapter does not execute config as an application hook. See [Vite Setup](../../../introduction/vite.md).

See [Vite](README.md) for related methods and types.
