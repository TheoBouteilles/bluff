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
  player_dead: 'Ce joueur n’est plus en vie.',
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
  not_opportunist: 'Réservé à l’Opportuniste.',
  players_not_ready: 'Certains joueurs n’ont pas encore validé leur choix.',
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
  ghost?: string
}

export type NightResult = {
  casino?: { stake: number; won: boolean }
  don?: { target: string; amount: number; ok?: boolean }
  gifts_received?: number
  rumeur?: { targets: string[]; has_saboteur: boolean }
  observation?: { target: string; location: string | null }
  sabotage?: { location: string; success: boolean; shared?: boolean }
  casino_steal?: number
  cimetiere?: { tomb?: number; ghost?: string; ok: boolean; spirits: { ghost_id: string; suspect_id: string | null }[] }
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
export type FinalRole = { player_id: string; role_id: string; team: string; solo_won?: boolean; side?: string | null }

export const cancelNightAction = (roomId: string, playerId?: string) =>
  rpc<void>('cancel_night_action', { p_room_id: roomId, p_player_id: playerId ?? null })
export const cancelVote = (roomId: string, playerId?: string) =>
  rpc<void>('cancel_vote', { p_room_id: roomId, p_player_id: playerId ?? null })
export const cancelGhostWatch = (roomId: string, playerId?: string) =>
  rpc<void>('cancel_ghost_watch', { p_room_id: roomId, p_player_id: playerId ?? null })

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
  haunt?: string | null
}
export const submitGhostWatch = (roomId: string, targetId: string, playerId?: string) =>
  rpc<void>('submit_ghost_watch', { p_room_id: roomId, p_target: targetId, p_player_id: playerId ?? null })
export const setGhostHint = (roomId: string, suspectId: string | null, playerId?: string) =>
  rpc<void>('set_ghost_hint', { p_room_id: roomId, p_suspect: suspectId, p_player_id: playerId ?? null })
export const getGhostReport = (roomId: string, playerId?: string) =>
  rpc<GhostReport>('get_ghost_report', { p_room_id: roomId, p_player_id: playerId ?? null })
export const setGhostHaunt = (roomId: string, allyId: string | null, playerId?: string) =>
  rpc<void>('set_ghost_haunt', { p_room_id: roomId, p_ally: allyId, p_player_id: playerId ?? null })
export type SaboteurVision = {
  allies: { player_id: string; location: string | null; validated?: boolean }[]
  haunts: { ghost_id: string; ally_id: string }[]
}
export const setNightDraft = (roomId: string, location: string | null, playerId?: string) =>
  rpc<void>('set_night_draft', { p_room_id: roomId, p_location: location, p_player_id: playerId ?? null })
export const getSaboteurVision = (roomId: string, playerId?: string) =>
  rpc<SaboteurVision>('get_saboteur_vision', { p_room_id: roomId, p_player_id: playerId ?? null })
export const setGhostTomb = (roomId: string, tomb: number, playerId?: string) =>
  rpc<void>('set_ghost_tomb', { p_room_id: roomId, p_tomb: tomb, p_player_id: playerId ?? null })

// Statistiques et trophées (migration 0017_stats.sql)
export type RecentGame = {
  ended_at: string
  room_code: string
  rounds: number
  team: string
  role_id: string
  won: boolean
  alive_at_end: boolean
}
export type MyStats = {
  games: number
  wins: number
  villageois_games: number
  villageois_wins: number
  saboteurs_games: number
  saboteurs_wins: number
  solitaires_games?: number
  solitaires_wins?: number
  current_streak: number
  best_streak: number
  nights_survived: number
  killed: number
  eliminated: number
  alive_at_end: number
  votes_cast: number
  votes_on_saboteur: number
  wrongly_eliminated: number
  casino_bets: number
  casino_wins: number
  casino_net: number
  casino_best_win: number
  gifts_given: number
  gifts_received: number
  mairie_success: number
  mairie_fail: number
  kills: number
  sabotages_ok: number
  ghost_games: number
  ghost_right: number
  cemetery_good_hints: number
  locations: Record<string, number>
  trophies: { id: string; unlocked_at: string }[]
  recent: RecentGame[]
}
export const getMyStats = () => rpc<MyStats>('get_my_stats', {})
export const getNewTrophies = (roomId: string) => rpc<string[]>('get_new_trophies', { p_room_id: roomId })

// Récap de fin de partie, visible par tous les joueurs du salon (migration 0022)
export type RecapPlayer = {
  player_id: string
  tokens: number
  killed_round: number | null
  eliminated_round: number | null
  nights: number
  kills: number
  casino_bets: number
  casino_net: number
  gifts_given: number
  gifts_received: number
  mairie_ok: number
  mairie_fail: number
  sabotages: number
  feats: string[] // exploits de la partie
  new_trophies: string[] // trophées débloqués pour la première fois (hors debug)
}
export type RecapNight = {
  round: number
  moves: { player_id: string; location: string }[]
  deaths: { player_id: string; location: string | null }[]
  sabotages: { player_id: string; location: string; success: boolean }[]
  rigs: { player_id: string; kind: 'boost' | 'shield' | 'backfire'; target_id: string | null }[]
}
export type GameRecap = {
  players: RecapPlayer[]
  nights: RecapNight[]
  votes: { round: number; eliminated_id: string | null; eliminated_team: string | null; tally: Record<string, number>; tied: boolean; runoffs: number; drawn: boolean }[]
}
export const getGameRecap = (roomId: string) => rpc<GameRecap>('get_game_recap', { p_room_id: roomId })

// Opportuniste : parier sur un camp (la nuit ; premier choix gratuit)
export const setOpportunistSide = (roomId: string, side: 'villageois' | 'saboteurs', playerId?: string) =>
  rpc<void>('set_opportunist_side', { p_room_id: roomId, p_side: side, p_player_id: playerId ?? null })

// Équilibrage : agrégats anonymes de toutes les parties terminées hors debug (migration 0019)
export type BalanceGame = {
  ended_at: string
  players: number
  saboteurs: number | null
  solitaires: number | null
  rounds: number
  minutes: number | null
  winner: 'villageois' | 'saboteurs' | null
  ended_by: 'nuit' | 'vote' | null
  solo: { role: string; won: boolean }[]
  settings: Record<string, number>
}
export type BalanceStats = {
  games: number
  villageois: number
  saboteurs: number
  ended_nuit: number
  ended_vote: number
  avg_rounds: number | null
  avg_minutes: number | null
  by_players: { players: number; games: number; villageois: number; saboteurs: number; avg_rounds: number | null; avg_minutes: number | null }[]
  solitaires: Record<string, { games: number; wins: number }>
  recent: BalanceGame[]
}
export const getBalanceStats = () => rpc<BalanceStats>('get_balance_stats', {})

// Profil (migration 0021) : pseudo, avatar, apparence et préférences, pour invités comme pour comptes
export type Profile = {
  nickname: string | null
  avatar: number | null
  look: { t?: number; a?: number }
  prefs: Record<string, unknown>
}
export const getMyProfile = () => rpc<Profile>('get_my_profile', {})
export const saveMyProfile = (p: { nickname?: string | null; avatar?: number | null; look?: { t?: number; a?: number } | null; prefs?: Record<string, unknown> | null }) =>
  rpc<Profile>('save_my_profile', { p_nickname: p.nickname ?? null, p_avatar: p.avatar ?? null, p_look: p.look ?? null, p_prefs: p.prefs ?? null })
export const createMergeTicket = () => rpc<string | null>('create_merge_ticket', {})
export const claimMergeTicket = (ticket: string) =>
  rpc<{ merged: boolean; games?: number; seats?: number }>('claim_merge_ticket', { p_ticket: ticket })
