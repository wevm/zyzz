/** Applies the root theme, then mounts the playground with Svelte's client runtime. @module */
import { mount } from 'svelte'
import 'zyzz/reset.css'
import App from './App.svelte'
import * as Appearance from './appearance.js'

const target = document.getElementById('root')
if (!target) throw new Error('Missing playground root.')

Appearance.initialize()
mount(App, { target })
