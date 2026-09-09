# Theme Application

Call a theme to obtain web props without generating CSS or accessing the DOM.

```tsx
<html {...zyzz.theme({ colorScheme: 'light dark' })}>
  <head><title>My App</title></head>
  <body>Content</body>
</html>
```

## Signature

`theme(options = {})`

The callable retains `className`, `css`, `tokens`, and other theme members. Named config themes use the same contract: `zyzz.themes.mint(options)`. Source compilation supplies the scope identity.

## Parameters

### options.colorScheme

- Type: `'light' | 'dark' | 'light dark' | undefined`
- Default: Omitted.

Choose an explicit scheme or follow system preference. Omission emits no style property, preserving inherited CSS behavior.

```ts
zyzz.theme({ colorScheme: 'dark' })
```

## Returns

### className

- Type: `string`

Generated, isolated theme scope class. Identical to `theme.className`.

```ts
zyzz.theme().className
```

### style

- Type: `{ colorScheme: 'light' | 'dark' | 'light dark' }`, when supplied.

Inline color-scheme selection. No `style` key is emitted when the option is omitted.

```ts
zyzz.theme({ colorScheme: 'dark' }).style
```

## Errors

Reject unsupported schemes and unknown options. Untransformed authoring throws the missing-transform error. Calls do not read storage, persist preferences, or mutate their theme.

## Composition

The application handles merging unrelated root classes and inline styles, as with other JSX spreads. Apply one theme from a compatible catalog per element. Nested elements can select compatible alternatives without changing component classes.
