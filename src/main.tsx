import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import App from './App.tsx'
import { playSfx, unlockAudio } from './lib/audio'

// Premier appui : débloque l'audio (règle des navigateurs). Chaque bouton fait un petit « tic ».
document.addEventListener('pointerdown', (e) => {
  unlockAudio()
  const el = (e.target as Element | null)?.closest('button, a, [role="tab"], [role="switch"]')
  if (el && !(el as HTMLButtonElement).disabled) playSfx('tap')
}, { capture: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)