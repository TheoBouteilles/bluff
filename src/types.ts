export type Phase = 'lobby' | 'night' | 'day' | 'vote' | 'result' | 'ended'

export type Room = {
  id: string
  code: string
  status: 'lobby' | 'playing' | 'ended'
  debug: boolean
  created_at: string
  mode: 'simple' | 'roles'
  round: number
  phase: Phase
  phase_ends_at: string | null
  winner: 'villageois' | 'saboteurs' | null
  vote_step: number
  vote_candidates: string[] | null
  sudden_death: boolean
}

export type Player = {
  id: string
  room_id: string
  user_id: string | null
  nickname: string
  avatar: number
  is_host: boolean
  is_bot: boolean
  is_alive: boolean
  joined_at: string
}

export type PlayerSecret = {
  player_id: string
  role_id: string
  team: 'villageois' | 'saboteurs' | 'solitaires'
  tokens: number
}