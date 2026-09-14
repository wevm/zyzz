/** @jsxImportSource solid-js */
/** Applies the root theme, then mounts the playground with Solid's renderer. @module */
import { render } from 'solid-js/web'
import 'zyzz/reset.css'
import { App } from './App.js'
import { appearance } from './appearance.js'

const root = document.getElementById('root')
if (!root) throw new Error('Missing playground root.')

appearance.restore()
render(() => <App />, root)
