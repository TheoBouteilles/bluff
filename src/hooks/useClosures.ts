import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Lieux fermés (sabotage) pendant la manche indiquée
export function useClosures(roomId: string | undefined, round: number, enabled: boolean) {
  const [closed, setClosed] = useState<string[]>([])

  useEffect(() => {
    if (!enabled || !roomId || round < 1) {
      setClosed([])
      return
    }
    let cancelled = false
    supabase
      .from('closures')
      .select('location')
      .eq('room_id', roomId)
      .eq('round', round)
      .then(({ data }) => {
        if (!cancelled) setClosed(((data ?? []) as { location: string }[]).map((r) => r.location))
      })
    return () => { cancelled = true }
  }, [roomId, round, enabled])

  return closed
}
