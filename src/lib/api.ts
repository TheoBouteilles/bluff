import { supabase } from './supabase'
import { ensureSession } from './auth'

export type RoomInfo = { room_id: string; code: string; player_id: string }

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Connexion impossible. Recharge la page.',
  invalid_nickname: 'Choisis un pseudo de 1 à 20 caractères.',
  room_not_found: 'Aucun salon avec ce code.',
  game_started: 'La partie a déjà commencé.',
  room_full: 'Le salon est complet (10 joueurs maximum).',
  nickname_taken: 'Ce pseudo est déjà pris dans ce salon.',
  not_host: 'Seul l’hôte peut faire ça.',
  not_enough_players: 'Il faut au moins 4 joueurs.',
  debug_disabled: 'Le mode debug n’est pas activé dans ce salon.',
}

export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? ''
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  return key ? MESSAGES[key] : 'Une erreur est survenue. Réessaie.'
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureSession()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const createRoom = (nickname: string, debug: boolean) =>
  rpc<RoomInfo>('create_room', { p_nickname: nickname, p_debug: debug })
export const joinRoom = (code: string, nickname: string) =>
  rpc<RoomInfo>('join_room', { p_code: code, p_nickname: nickname })
export const leaveRoom = (roomId: string) => rpc<void>('leave_room', { p_room_id: roomId })
export const startGame = (roomId: string) => rpc<void>('start_game', { p_room_id: roomId })
export const heartbeat = (roomId: string) => rpc<void>('heartbeat', { p_room_id: roomId })
export const claimHost = (roomId: string) => rpc<boolean>('claim_host', { p_room_id: roomId })
export const addBot = (roomId: string) => rpc<void>('add_bot', { p_room_id: roomId })
export const removeBot = (playerId: string) => rpc<void>('remove_bot', { p_player_id: playerId })

// Dernier salon visité (pour proposer « Reprendre la partie »)
const KEY = 'bluff:lastRoom'
export const saveLastRoom = (code: string) => {
  try { localStorage.setItem(KEY, code) } catch { /* stockage indisponible */ }
}
export const getLastRoom = (): string | null => {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export const clearLastRoom = () => {
  try { localStorage.removeItem(KEY) } catch { /* stockage indisponible */ }
}