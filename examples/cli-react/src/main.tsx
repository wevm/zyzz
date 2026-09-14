/** Applies the root theme, then mounts the playground with ordinary React props. @module */
import { createRoot } from 'react-dom/client'
import 'zyzz/reset.css'
import { App } from './App.js'
import * as Appearance from './appearance.js'

const root = document.getElementById('root')
if (!root) throw new Error('Missing playground root.')

Appearance.initialize()
createRoot(root).render(<App />)
