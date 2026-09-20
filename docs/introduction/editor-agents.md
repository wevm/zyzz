# Editor and Agents

Use TypeScript inference from named config helpers such as `style`, `vars`, and `variants`. Keep config values literal so token names and named theme choices remain narrow.

```ts
import { style } from '../../zyzz.config.js'

namespace styles {
  export const card = style({ padding: 'md' })
}
```

- **Agents:** start from [the documentation index](../llms.txt), then load the relevant method and guide.
- **Diagnostics:** preserve source locations and resolve errors before consuming new artifacts.
- **Examples:** copy the owning config and integration setup along with the style definition.
- **Types:** use editor completions and public declarations; unsupported names should fail rather than widen to arbitrary strings.

No dedicated editor extension or agent server is required by this documentation workflow.
