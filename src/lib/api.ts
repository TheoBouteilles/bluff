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
  not_member: 'Tu ne fais pas partie de ce salon.',
  not_night: 'La nuit est terminée.',
  invalid_target: 'Joueur invalide.',
  player_dead: 'Ce joueur est éliminé.',
  invalid_location: 'Lieu inconnu.',
  night_not_over: 'La nuit n’est pas terminée.',
  location_closed: 'Ce lieu est fermé cette nuit.',
  maison_twice: 'Tu ne peux pas rester chez toi deux nuits de suite.',
  not_enough_tokens: 'Pas assez de jetons pour cette action.',
  invalid_params: 'Choix invalide.',
  not_vote: 'Le vote n’est pas ouvert.',
  not_ended: 'La partie n’est pas terminée.',
  not_saboteur: 'Réservé aux Saboteurs.',
  room_settings: 'Réglage invalide.',
  not_ghost: 'Réservé aux fantômes.',
  tomb_locked: 'Ta tombe est déjà choisie : ce choix est définitif.',
  not_playing: 'La partie n’est pas en cours.',
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
export const resetRoom = (roomId: string) => rpc<void>('reset_room', { p_room_id: roomId })
export type NightParams = {
  stake?: number
  action?: 'none' | 'don' | 'rumeur'
  target?: string
  targets?: string[]
  sabotage?: string
  rig?: 'boost' | 'shield'
  tomb?: number
}

export type NightResult = {
  casino?: { stake: number; won: boolean }
  don?: { target: string; amount: number; ok?: boolean }
  gifts_received?: number
  rumeur?: { targets: string[]; has_saboteur: boolean }
  observation?: { target: string; location: string | null }
  sabotage?: { location: string; success: boolean }
  cimetiere?: { tomb: number; ok: boolean; spirits: { ghost_id: string; suspect_id: string | null }[] }
  mairie?: { attempted: boolean; success: boolean; crowded?: boolean; rig?: 'boost' | 'shield'; target?: string | null }
}

export type DawnReport = {
  location: string | null
  present: string[]
  result: NightResult
  closed_next: string[]
  cry: boolean
  killed: boolean
  deaths: { player_id: string; location: string | null }[]
}

export const submitNightAction = (roomId: string, location: string, playerId?: string, params: NightParams = {}) =>
  rpc<void>('submit_night_action', { p_room_id: roomId, p_location: location, p_player_id: playerId ?? null, p_params: params })
export type VoteResult = {
  room_id: string
  round: number
  eliminated_id: string | null
  eliminated_team: string | null
  tied: boolean
  tally: Record<string, number>
  runoffs: number
  drawn: boolean
}
export type FinalRole = { player_id: string; role_id: string; team: string }

export const submitVote = (roomId: string, targetId: string | null, playerId?: string) =>
  rpc<void>('submit_vote', { p_room_id: roomId, p_target: targetId, p_player_id: playerId ?? null })
export const getVoteProgress = (roomId: string) => rpc<NightProgress>('vote_progress', { p_room_id: roomId })
export const getFinalRoles = (roomId: string) => rpc<FinalRole[]>('get_final_roles', { p_room_id: roomId })
export type NightProgress = { played: number; total: number }
export const getNightProgress = (roomId: string) => rpc<NightProgress>('night_progress', { p_room_id: roomId })
export const advancePhase = (roomId: string, force = false) =>
  rpc<void>('advance_phase', { p_room_id: roomId, p_force: force })
export const getDawnReport = (roomId: string, round: number, playerId?: string) =>
  rpc<DawnReport>('get_dawn_report', { p_room_id: roomId, p_round: round, p_player_id: playerId ?? null })
export const getAllies = (roomId: string, playerId?: string) =>
  rpc<string[]>('get_allies', { p_room_id: roomId, p_player_id: playerId ?? null })

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
export const getRoomSettings = (roomId: string) => rpc<Record<string, number>>('get_room_settings', { p_room_id: roomId })
export const updateRoomSettings = (roomId: string, values: Record<string, number>) =>
  rpc<Record<string, number>>('update_room_settings', { p_room_id: roomId, p_values: values })
export const resetRoomSettings = (roomId: string) => rpc<Record<string, number>>('reset_room_settings', { p_room_id: roomId })

export type GhostReport = {
  ghost: boolean
  watches: { round: number; target_id: string; location: string | null }[]
  suspect: string | null
  tomb: number | null
}
export const submitGhostWatch = (roomId: string, targetId: string, playerId?: string) =>
  rpc<void>('submit_ghost_watch', { p_room_id: roomId, p_target: targetId, p_player_id: playerId ?? null })
export const setGhostHint = (roomId: string, suspectId: string | null, playerId?: string) =>
  rpc<void>('set_ghost_hint', { p_room_id: roomId, p_suspect: suspectId, p_player_id: playerId ?? null })
export const getGhostReport = (roomId: string, playerId?: string) =>
  rpc<GhostReport>('get_ghost_report', { p_room_id: roomId, p_player_id: playerId ?? null })
export const setGhostTomb = (roomId: string, tomb: number, playerId?: string) =>
  rpc<void>('set_ghost_tomb', { p_room_id: roomId, p_tomb: tomb, p_player_id: playerId ?? null })
