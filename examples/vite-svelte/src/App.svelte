<!-- Presents small, independent examples under the root theme carried by <html>. -->
<script lang="ts">
  import { appearance, type Selection } from './appearance.js'
  import { styles } from './App.styles.js'
  import Dynamic from './Dynamic.svelte'
  import Motion from './Motion.svelte'
  import Queries from './Queries.svelte'
  import Relationships from './Relationships.svelte'
  import Styling from './Styling.svelte'
  import { themes } from './zyzz.config.js'

  let selection = $state(appearance.current())

  function select(next: Partial<Selection>) {
    selection = { ...selection, ...next }
    appearance.select(selection)
  }
</script>

<!-- The root selection lives on <html>; nested scopes inherit without a provider or listener. -->
<main {...styles.page()}>
  <div {...styles.content()}>
    <header>
      <h1>Zyzz examples</h1>
      <p>Svelte + Vite</p>
      <div {...styles.row()}>
        <button
          {...styles.button()}
          aria-pressed={selection.theme === 'indigo'}
          onclick={() => select({ theme: 'indigo' })}
        >
          Indigo
        </button>
        <button
          {...styles.button()}
          aria-pressed={selection.theme === 'mint'}
          onclick={() => select({ theme: 'mint' })}
        >
          Mint
        </button>
        <label>
          Color scheme
          <select
            aria-label="Color scheme"
            value={selection.colorScheme}
            onchange={(event) => {
              const value = event.currentTarget.value
              if (value === 'light' || value === 'dark' || value === 'light dark')
                select({ colorScheme: value })
            }}
          >
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
              select({
                theme: selection.theme === 'indigo' ? 'mint' : 'indigo',
              })}
          >
            Parent: {selection.theme}
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
