import { useEffect, useState } from 'react'
import { getAllies } from '../lib/api'

// Identifiants des complices (null tant que le chargement n'est pas fini)
export function useAllies(roomId: string | undefined, playerId: string | undefined, enabled: boolean) {
  const [ids, setIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!enabled || !roomId || !playerId) {
      setIds(null)
      return
    }
    let cancelled = false
    setIds(null)
    getAllies(roomId, playerId)
      .then((r) => { if (!cancelled) setIds(r) })
      .catch(() => { if (!cancelled) setIds([]) })
    return () => { cancelled = true }
  }, [roomId, playerId, enabled])

  return ids
}