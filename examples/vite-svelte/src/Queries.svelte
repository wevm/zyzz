<!-- Resizes a query container without changing the viewport. -->
<script lang="ts">
  import { styles } from './Queries.styles.js'

  let width = $state(100)
</script>

<section {...styles.section()}>
  <h2>Responsive conditions</h2>
  <label {...styles.row()}>
    Container width
    <input
      aria-label="Container width"
      type="range"
      min="35"
      max="100"
      bind:value={width}
    />
    <output>{width}%</output>
  </label>
  <div {...styles.container({ width: `${width}%` })}>
    <div {...styles.content()} data-testid="query-content">
      <strong>Scoped accent</strong>
      <span class="scope-stop">
        <strong>Outside scope</strong>
      </span>
    </div>
  </div>
  <p {...styles.muted()}>
    Above 20rem, the container has two columns. A wide viewport thickens its
    border. Supports and scope rules stay in CSS.
  </p>
</section>
