import { useEffect, useState } from 'react'
import { getNightProgress } from '../lib/api'
import type { NightProgress } from '../lib/api'

// Nombre de joueurs ayant choisi un lieu (aucun secret), rafraîchi toutes les 3 s
export function useNightProgress(roomId: string | undefined, enabled: boolean, version: unknown) {
  const [progress, setProgress] = useState<NightProgress | null>(null)

  useEffect(() => {
    if (!enabled || !roomId) {
      setProgress(null)
      return
    }
    let cancelled = false
    const load = () =>
      getNightProgress(roomId)
        .then((p) => { if (!cancelled) setProgress(p) })
        .catch(() => undefined)
    load()
    const id = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [roomId, enabled, version])

  return progress
}
