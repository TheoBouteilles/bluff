import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'
import { claimHost, heartbeat } from '../lib/api'
import type { Player, Room } from '../types'

export function useRoom(code: string) {
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const user = await ensureSession()
      const { data: r } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
      if (!r) {
        setRoom(null)
        setState('notfound')
        return
      }
      const { data: p } = await supabase
        .from('players').select('*').eq('room_id', r.id).order('joined_at')
      setRoom(r as Room)
      setPlayers((p ?? []) as Player[])
      setUserId(user.id)
      setState('ready')
    } catch {
      setState((s) => (s === 'loading' ? 'notfound' : s))
    }
  }, [code])

  const me = players.find((p) => p.user_id === userId) ?? null
  const roomId = room?.id
  const isMember = !!me
  const isHost = me?.is_host ?? false

  // Chargement initial
  useEffect(() => {
    refresh()
  }, [refresh])

  // Temps réel : tout changement recharge la liste ; rechargement aussi au retour sur l'onglet
  useEffect(() => {
    if (!roomId) return
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => refresh())
      .subscribe()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [roomId, refresh])

  // Présence + reprise du rôle d'hôte si l'hôte a disparu
  useEffect(() => {
    if (!roomId || !isMember) return
    const tick = async () => {
      try {
        await heartbeat(roomId)
        if (!isHost) await claimHost(roomId)
      } catch {
        /* réseau coupé : on réessaie au prochain tour */
      }
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [roomId, isMember, isHost])

  return { state, room, players, me, refresh }
}