<!-- Replays entry motion by recreating only the preview inside a key block. -->
<script lang="ts">
  import grid from './grid.svg'
  import { styles } from './Motion.styles.js'

  let count = $state(0)
</script>

<section {...styles.section()}>
  <h2>Motion & assets</h2>
  <button {...styles.button()} onclick={() => (count += 1)}>
    Replay animation
  </button>
  {#key count}
    <div {...styles.tile({ style: { backgroundImage: `url("${grid}")` } })}>
      <div {...styles.dot()} data-testid="motion-dot"></div>
      <p>Imported keyframes. Local SVG background.</p>
    </div>
  {/key}
  <p {...styles.muted()}>
    Both animations respect the system reduced-motion setting.
  </p>
</section>
