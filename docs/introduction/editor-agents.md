# Editor and Agents

Use TypeScript inference from the named `zyzz` export. Keep config values literal so token names and variant choices remain narrow.

```ts
import { style } from '../../zyzz.config.js'

const styles = {
  card: style({ padding: 'md' }),
}
```

> [!NOTE]
> Config-bound authoring is a preview. Current root `style` and in-memory theme definitions expose their documented types.

- **Agents:** start from [the documentation index](../llms.txt), then load the relevant method and guide.
- **Diagnostics:** preserve source locations and resolve errors before consuming new artifacts.
- **Examples:** copy the owning config and integration setup along with the style definition.
- **Types:** use editor completions and public declarations; unsupported names should fail rather than widen to arbitrary strings.

No dedicated editor extension or agent server is required by this documentation workflow.
