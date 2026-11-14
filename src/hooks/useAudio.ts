import { useEffect, useSyncExternalStore } from 'react'
import { getAudioSettings, setMusic, subscribeAudio } from '../lib/audio'
import type { Theme } from '../lib/audio'

// Réglages audio de l'appareil (se met à jour quand on les change)
export function useAudioSettings() {
  return useSyncExternalStore(subscribeAudio, getAudioSettings)
}

// Musique d'ambiance de l'écran courant (jouée seulement si la musique est activée)
export function useMusic(theme: Theme | null) {
  useEffect(() => { setMusic(theme) }, [theme])
}
