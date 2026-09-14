/** Applies the root theme, then mounts the playground with Svelte's client runtime. @module */
import { mount } from 'svelte'
import 'zyzz/reset.css'
import App from './App.svelte'
import { appearance } from './appearance.js'

const target = document.getElementById('root')
if (!target) throw new Error('Missing playground root.')

appearance.restore()
mount(App, { target })
