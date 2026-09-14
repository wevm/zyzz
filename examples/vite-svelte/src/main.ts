/** Mounts the playground with Svelte's client runtime. @module */
import { mount } from 'svelte'
import 'zyzz/reset.css'
import App from './App.svelte'

const target = document.getElementById('root')
if (!target) throw new Error('Missing playground root.')

mount(App, { target })
