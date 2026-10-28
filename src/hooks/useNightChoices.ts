import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NightParams } from '../lib/api'

export type NightChoice = { location: string; params: NightParams }

// Choix de la manche (le tien, et ceux des bots si tu es l'hôte d'un salon debug)
export function useNightChoices(roomId: string | undefined, round: number, enabled: boolean) {
  const [choices, setChoices] = useState<Record<string, NightChoice>>({})

  const load = useCallback(async () => {
    if (!roomId) return
    const { data } = await supabase
      .from('night_actions')
      .select('player_id, location, params')
      .eq('room_id', roomId)
      .eq('round', round)
    const map: Record<string, NightChoice> = {}
    for (const r of (data ?? []) as { player_id: string; location: string; params: NightParams | null }[]) {
      map[r.player_id] = { location: r.location, params: r.params ?? {} }
    }
    setChoices(map)
  }, [roomId, round])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  return { choices, reload: load }
}
