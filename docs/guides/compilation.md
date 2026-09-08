# Compile Libraries and Build Tools

Use compiler APIs when building a library pipeline or a custom integration. For application setup, start with [Getting Started](getting-started.md).

## Compile Styles

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: { display: 'flex', padding: '1rem' },
})
const output = Css.compile({ styles })
```

Load `output.css` as a stylesheet and apply `output.classes.card` to the element. The compiler has no filesystem or browser side effects. [Literal styles](../literal-styles.md) documents supported values; [themes](../themes.md) adds token references and compatible scopes.

## Transform Source

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'example/button.ts',
  source: `import { css } from 'zyzz';
export const button = css({ padding: '1rem' });`,
})
```

Bundle the returned `code` and load its matching `css`. Keep their source maps together. Apply the exported `button()` props to an element. A stable package-relative module ID prevents unrelated modules sharing identities. Source extraction alone does not rewrite executable calls.

For filesystem builds, `Host.create({ outDir, packageId, root })` from `zyzz/node` returns build/watch/close operations. It writes module and CSS sidecars; loading CSS and lowering TypeScript/JSX remain application build responsibilities.

## Publish Matching Artifacts

- **Code:** publish transformed modules and declarations.
- **CSS:** publish the matching stylesheet and document its import path.
- **Identity:** keep modules, class maps, CSS, and source maps from the same compilation together.

Consumers load the stylesheet once. They do not need Zyzz compilation for already-transformed library code.
