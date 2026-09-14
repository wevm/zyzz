/** @jsxImportSource solid-js */
/** Mounts the playground with Solid's renderer. @module */
import { render } from 'solid-js/web'
import 'zyzz/reset.css'
import { App } from './App.js'

const root = document.getElementById('root')
if (!root) throw new Error('Missing playground root.')

render(() => <App />, root)
