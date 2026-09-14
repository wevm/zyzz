/** Mounts the playground with ordinary React props. @module */
import { createRoot } from 'react-dom/client'
import 'zyzz/reset.css'
import { App } from './App.js'

const root = document.getElementById('root')
if (!root) throw new Error('Missing playground root.')

createRoot(root).render(<App />)
