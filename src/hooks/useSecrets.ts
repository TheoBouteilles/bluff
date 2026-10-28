import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlayerSecret } from '../types'

// Charge les secrets visibles : le sien, et ceux des bots si tu es l'hôte d'un salon debug (règles RLS)
export function useSecrets(playerIds: string[], enabled: boolean) {
  const [secrets, setSecrets] = useState<Record<string, PlayerSecret>>({})
  const [ready, setReady] = useState(false)
  const key = playerIds.join(',')

  const load = useCallback(async () => {
    if (playerIds.length === 0) return
    const { data } = await supabase.from('player_secrets').select('*').in('player_id', playerIds)
    const map: Record<string, PlayerSecret> = {}
    for (const s of (data ?? []) as PlayerSecret[]) map[s.player_id] = s
    setSecrets(map)
    setReady(true)
  }, [key])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  return { secrets, ready, reload: load }
}