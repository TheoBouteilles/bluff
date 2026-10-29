import { useCallback, useEffect, useState } from 'react'
import { getFinalRoles, getVoteProgress } from '../lib/api'
import type { FinalRole, NightProgress, VoteResult } from '../lib/api'
import { supabase } from '../lib/supabase'

// Ton vote (et ceux des bots si tu es l'hôte d'un salon debug) : joueur -> cible (null = abstention)
export function useVoteChoices(roomId: string | undefined, round: number, enabled: boolean) {
  const [choices, setChoices] = useState<Record<string, string | null>>({})

  const load = useCallback(async () => {
    if (!roomId) return
    const { data } = await supabase
      .from('votes')
      .select('voter_id, target_id')
      .eq('room_id', roomId)
      .eq('round', round)
    const map: Record<string, string | null> = {}
    for (const r of (data ?? []) as { voter_id: string; target_id: string | null }[]) map[r.voter_id] = r.target_id
    setChoices(map)
  }, [roomId, round])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  return { choices, reload: load }
}

// Résultats publics de tous les votes déjà dépouillés
export function useVoteResults(roomId: string | undefined, enabled: boolean, version: unknown) {
  const [results, setResults] = useState<VoteResult[]>([])

  useEffect(() => {
    if (!enabled || !roomId) {
      setResults([])
      return
    }
    let cancelled = false
    supabase
      .from('vote_results')
      .select('*')
      .eq('room_id', roomId)
      .order('round')
      .then(({ data }) => {
        if (!cancelled) setResults((data ?? []) as VoteResult[])
      })
    return () => { cancelled = true }
  }, [roomId, enabled, version])

  return results
}

// Compteur « X/Y ont voté », rafraîchi toutes les 3 s (hôte)
export function useVoteProgress(roomId: string | undefined, enabled: boolean, version: unknown) {
  const [progress, setProgress] = useState<NightProgress | null>(null)

  useEffect(() => {
    if (!enabled || !roomId) {
      setProgress(null)
      return
    }
    let cancelled = false
    const load = () =>
      getVoteProgress(roomId)
        .then((p) => { if (!cancelled) setProgress(p) })
        .catch(() => undefined)
    load()
    const id = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [roomId, enabled, version])

  return progress
}

// Tous les rôles, une fois la partie terminée
export function useFinalRoles(roomId: string | undefined, enabled: boolean) {
  const [roles, setRoles] = useState<FinalRole[]>([])

  useEffect(() => {
    if (!enabled || !roomId) {
      setRoles([])
      return
    }
    let cancelled = false
    getFinalRoles(roomId)
      .then((r) => { if (!cancelled) setRoles(r) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [roomId, enabled])

  return roles
}
