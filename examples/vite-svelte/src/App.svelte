<!-- Presents small, independent examples under a selectable theme scope. -->
<script lang="ts">
  import { styles } from './App.styles.js'
  import Dynamic from './Dynamic.svelte'
  import Motion from './Motion.svelte'
  import Queries from './Queries.svelte'
  import Relationships from './Relationships.svelte'
  import Styling from './Styling.svelte'
  import { themes } from './zyzz.config.js'

  let appearance: 'indigo' | 'mint' = $state('indigo')
  let scheme: 'light' | 'dark' | 'light dark' = $state('light dark')
</script>

<!-- Theme changes inherit naturally without a provider or preference listener. -->
<div {...themes({ theme: appearance, colorScheme: scheme })}>
  <main {...styles.page()}>
    <div {...styles.content()}>
      <header>
        <h1>Zyzz examples</h1>
        <p>Svelte + Vite</p>
        <div {...styles.row()}>
          <button
            {...styles.button()}
            aria-pressed={appearance === 'indigo'}
            onclick={() => (appearance = 'indigo')}
          >
            Indigo
          </button>
          <button
            {...styles.button()}
            aria-pressed={appearance === 'mint'}
            onclick={() => (appearance = 'mint')}
          >
            Mint
          </button>
          <label>
            Color scheme
            <select aria-label="Color scheme" bind:value={scheme}>
              <option value="light dark">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>
      <div {...styles.grid()}>
        <Styling />
        <Dynamic />
        <Relationships />
        <Queries />
        <Motion />
        <section {...styles.section()}>
          <h2>Nested theme</h2>
          <p {...styles.muted()}>
            Tap the parent button. The nested theme stays mint and dark.
          </p>
          <div {...styles.nested()} data-testid="parent-theme">
            <button
              {...styles.sample()}
              onclick={() =>
                (appearance = appearance === 'indigo' ? 'mint' : 'indigo')}
            >
              Parent: {appearance}
            </button>
            <div {...themes({ theme: 'mint', colorScheme: 'dark' })}>
              <div {...styles.nested()} data-testid="nested-theme">
                <button {...styles.sample()}>Always mint + dark</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>
</div>
