import { useCallback, useEffect, useState } from 'react'
import { getGhostReport } from '../lib/api'
import type { GhostReport } from '../lib/api'

// Observations et suspect d'un fantôme (rechargé à chaque changement de phase ou d'action)
export function useGhostReport(roomId: string | undefined, playerId: string | undefined, enabled: boolean, version: unknown) {
  const [report, setReport] = useState<GhostReport | null>(null)

  const load = useCallback(async () => {
    if (!roomId || !playerId) return
    try {
      setReport(await getGhostReport(roomId, playerId))
    } catch { /* on garde l'état précédent */ }
  }, [roomId, playerId])

  useEffect(() => {
    if (enabled) load()
    else setReport(null)
  }, [enabled, load, version])

  return { report, reload: load }
}
