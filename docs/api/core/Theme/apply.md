# Theme Application

Apply a theme through the `style` prop. The compiler supplies its generated scope class and CSS variables.

```tsx
import { theme } from './zyzz.config.js'

export function Document() {
  return (
    <html style={{ ...theme, colorScheme: 'light dark' }}>
      <head>
        <title>My App</title>
      </head>
      <body>Content</body>
    </html>
  )
}
```

## Named Themes

Use `style={themes.mint}` for a named config theme. Nested elements can select compatible alternatives without changing component classes. Apply one compatible theme per element.

## Color Schemes

Declare `light dark` for `colorScheme` to follow system preference, or `light` / `dark` to select explicitly. Set `document.documentElement.style.colorScheme` when a user changes their preference. Color pairs compile to `light-dark()`.

## Compilation

Local definitions, imported themes, and named config members support direct JSX `style` application and inline overrides with `style={{ ...theme, colorScheme: 'dark' }}`. Dynamic catalog selection remains a preview. `theme.className` remains available for integrations that explicitly need the generated class.
