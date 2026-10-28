export type Room = {
  id: string
  code: string
  status: 'lobby' | 'playing' | 'ended'
  debug: boolean
  created_at: string
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