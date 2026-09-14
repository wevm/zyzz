<!-- One slider drives a callback binding and a variable inherited by a child. -->
<script lang="ts">
  import { styles, variables } from './Dynamic.styles.js'

  let amount = $state(50)
</script>

<section {...styles.section()}>
  <h2>Dynamic values & variables</h2>
  <label {...styles.row()}>
    Amount
    <input aria-label="Amount" type="range" min="0" max="100" bind:value={amount} />
    <output>{amount}%</output>
  </label>
  <div {...styles.track()}>
    <div {...styles.bar({ width: `${amount}%` })} data-testid="dynamic-bar"></div>
  </div>
  <div {...styles.scope({ variables: { [variables.amount]: amount / 100 } })}>
    <div {...styles.track()}>
      <div {...styles.inherited()} data-testid="variable-bar"></div>
    </div>
  </div>
  <p {...styles.muted()}>
    The first bar takes a typed callback value. The second fades using a shared
    variable set on its parent. Both use static CSS.
  </p>
</section>
