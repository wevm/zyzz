---
'zyzz': patch
---

Added `withStyles` and optional Reanimated hooks for Provider-selected variables and applied numeric or color properties.

```ts
import { withStyles } from 'zyzz/react-native'
import { useAnimatedVars } from 'zyzz/react-native/reanimated'

const StyledCard = withStyles(Card, { styleProps: ['bodyStyle'] })

function useBackground() {
  return useAnimatedVars(vars, (values) => values.color.background)
}
```
