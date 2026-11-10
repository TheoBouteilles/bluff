import { useEffect, useState } from 'react'
import { getSaboteurVision } from '../lib/api'
import type { SaboteurVision } from '../lib/api'

// Pendant la nuit : lieux validés des Saboteurs alliés et hantises en cours (option « saboteur_vision »)
export function useSaboteurVision(roomId: string | undefined, playerId: string | undefined, enabled: boolean) {
  const [vision, setVision] = useState<SaboteurVision | null>(null)

  useEffect(() => {
    if (!enabled || !roomId || !playerId) {
      setVision(null)
      return
    }
    let cancelled = false
    const load = () =>
      getSaboteurVision(roomId, playerId)
        .then((v) => { if (!cancelled) setVision(v) })
        .catch(() => undefined)
    load()
    const id = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [roomId, playerId, enabled])

  return vision
}
