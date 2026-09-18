/** Connects the TanStack Start playground to Zyzz compilation. @module */
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

// TanStack Start requires the React plugin after its own.
export default defineConfig({
  plugins: [zyzz(), tanstackStart(), react()],
})
