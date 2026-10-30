import { useCallback, useEffect, useState } from 'react'
import { applySettingsToCosts } from '../data/costs'
import { DEFAULT_SETTINGS } from '../data/settings'
import { getRoomSettings } from '../lib/api'
import { supabase } from '../lib/supabase'

// Réglages effectifs du salon (valeurs de l'hôte, sinon défauts), rafraîchis en temps réel.
// Les coûts affichés dans le jeu (COSTS) sont mis à jour en même temps.
export function useRoomSettings(roomId: string | undefined) {
  const [settings, setSettings] = useState<Record<string, number>>(DEFAULT_SETTINGS)

  const apply = useCallback((s: Record<string, number>) => {
    applySettingsToCosts(s)
    setSettings({ ...DEFAULT_SETTINGS, ...s })
  }, [])

  const reload = useCallback(async () => {
    if (!roomId) return
    try {
      apply(await getRoomSettings(roomId))
    } catch { /* on garde les valeurs actuelles */ }
  }, [roomId, apply])

  useEffect(() => {
    reload()
    if (!roomId) return
    const channel = supabase
      .channel(`settings-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_settings' }, () => reload())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, reload])

  return { settings, apply, reload }
}
