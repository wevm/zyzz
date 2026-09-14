<!-- Applies styles as native attributes without a wrapper or generated component. -->
<script lang="ts">
  import { styles } from './Styling.styles.js'

  let selected = $state(false)
</script>

<section {...styles.section()}>
  <h2>Styles & states</h2>
  <div {...styles.row()}>
    <button
      {...styles.button()}
      aria-pressed={selected}
      onclick={() => (selected = !selected)}
    >
      Toggle state
    </button>
    <button {...styles.button()} disabled>Disabled</button>
    <button {...styles.button({ style: { borderRadius: '0px' } })}>
      Inline override
    </button>
    <span {...styles.label({ className: 'example-label' })}>
      Shared declarations
    </span>
  </div>
  <p {...styles.muted()}>
    Hover, focus with Tab, or toggle. Static declarations, ordered fallbacks,
    importance, token references, and overrides live beside the component.
  </p>
</section>
