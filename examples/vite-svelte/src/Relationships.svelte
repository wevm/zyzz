<!-- Keeps application state in data attributes and native controls. -->
<script lang="ts">
  import { styles } from './Relationships.styles.js'

  let active = $state(false)
</script>

<section {...styles.section()}>
  <h2>Relationships</h2>
  <label {...styles.parent()}>
    <input type="checkbox" bind:checked={active} />
    Highlight children
  </label>
  <div {...styles.group()} data-active={active} data-testid="relationship-group">
    {#each [1, 2, 3] as item (item)}
      <div {...styles.item()}>Item {item}</div>
    {/each}
  </div>
  <p {...styles.sibling()}>A sibling selected by the empty group style.</p>
  <p {...styles.muted()}>
    Hover the group. The even child, checked parent, active ancestor, and
    adjacent sibling each use a string inside selectors.
  </p>
</section>
