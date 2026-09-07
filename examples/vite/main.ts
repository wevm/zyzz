import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './reset.css'
import { css } from 'typestyle'

const page = css({
  fontFamily: 'sans',
  color: 'gray.1000',
  backgroundColor: 'background.100',
  minHeight: '[100dvh]',
  padding: 6,
  '@md': { padding: 16 },
})
const container = css({ maxWidth: '[64rem]', marginInline: 'auto' })
const header = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 4,
  marginBottom: 20,
})
const logo = css({ typography: 'label.14-mono', color: 'gray.1000' })
const label = css({
  typography: 'label.12',
  color: 'blue.900',
  marginBottom: 6,
})
const heading = css({
  typography: 'heading.40',
  maxWidth: '[44rem]',
  marginBottom: 6,
  '@md': { typography: 'heading.64' },
})
const copy = css({
  typography: 'copy.18',
  color: 'gray.900',
  maxWidth: '[36rem]',
  marginBottom: 12,
})
const grid = css({
  display: 'grid',
  gap: 6,
  '@md': { gridTemplateColumns: '[1fr 1fr]' },
})
const panel = css({
  padding: 6,
  borderRadius: 'xl',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray.400',
  backgroundColor: 'background.200',
})
const title = css({ typography: 'label.14', marginBottom: 4 })
const code = css({
  typography: 'copy.14-mono',
  color: 'gray.1000',
  whiteSpace: 'pre-wrap',
  margin: 0,
})
const caption = css({ typography: 'copy.13', color: 'gray.900', marginTop: 5 })
const button = css({
  typography: 'button.14',
  paddingInline: 4,
  paddingBlock: 2,
  borderRadius: 'md',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray.400',
  backgroundColor: 'background.100',
  color: 'gray.1000',
  cursor: 'pointer',
  transitionProperty: '[transform]',
  transitionDuration: 140,
  transitionTimingFunction: 'out',
  '@hover': { ':hover': { backgroundColor: 'gray.100' } },
  ':active': { transform: '[scale(0.97)]' },
  ':focus-visible': {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: 'blue.700',
    outlineOffset: 4,
  },
  '@motion-reduce': {
    transitionDuration: 0,
    ':active': { transform: '[none]' },
  },
})
const primary = css({
  typography: 'button.14',
  backgroundColor: 'blue.700',
  color: 'white',
  borderWidth: 0,
  borderRadius: 'lg',
  paddingInline: 6,
  paddingBlock: 3,
  cursor: 'pointer',
  transitionProperty: '[transform]',
  transitionDuration: 140,
  transitionTimingFunction: 'out',
  ':hover': { backgroundColor: 'blue.800' },
  ':active': { transform: '[scale(0.97)]' },
  ':focus-visible': {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: 'blue.700',
    outlineOffset: 4,
  },
  '@motion-reduce': {
    transitionDuration: 0,
    ':active': { transform: '[none]' },
  },
})

const app = document.querySelector<HTMLDivElement>('#app')!
app.className = page
app.innerHTML = `<main class="${container}">
  <header class="${header}"><span class="${logo}">typestyle / 0.0</span><button id="theme" class="${button}">Switch theme</button></header>
  <p class="${label}">TYPED PROPS. STATIC CSS.</p>
  <h1 class="${heading}">Less syntax.<br>More certainty.</h1>
  <p class="${copy}">Geist colors and typography. Tailwind's foundations. A small TypeScript API that disappears from the bundle.</p>
  <section class="${grid}" aria-label="Styling example">
    <div class="${panel}"><h2 class="${title}">Write ordinary TypeScript</h2><pre class="${code}">const button = css({
  typography: 'button.14',
  color: 'white',
  backgroundColor: 'blue.700',
  paddingInline: 6,
  paddingBlock: 3,
  borderRadius: 'lg',
  ':hover': {
    backgroundColor: 'blue.800',
  },
})</pre></div>
    <div class="${panel}"><h2 class="${title}">Live result</h2><button id="counter" class="${primary}">Click to test · 0</button><p class="${caption}">Edit main.ts to see Vite update the stylesheet. Tab to the button to inspect its focus ring.</p></div>
  </section>
  <p class="${caption}">Proof of concept · No browser style engine · Light and dark from the same tokens</p>
</main>`
let count = 0
document.querySelector('#counter')!.addEventListener('click', (event) => {
  ;(event.currentTarget as HTMLButtonElement).textContent =
    `Click to test · ${++count}`
})
document.querySelector('#theme')!.addEventListener('click', () => {
  const current = getComputedStyle(document.documentElement).colorScheme
  document.documentElement.style.colorScheme =
    current === 'dark' ? 'light' : 'dark'
})
