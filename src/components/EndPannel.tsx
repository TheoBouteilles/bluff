import { useEffect, useState } from 'react'
import { Avatar } from './Px'
import GameRecap from './GameRecap'
import { TEAM_STYLE, getRole } from '../data/roles'
import type { TeamId } from '../data/roles'
import { getGameRecap } from '../lib/api'
import { playSfx } from '../lib/audio'
import type { FinalRole, GameRecap as Recap } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

// roomId absent (vitrine /demo) : pas d'appel, on affiche demoRecap
type Props = { roomId?: string; meId?: string; demoRecap?: Recap; winner: 'villageois' | 'saboteurs' | null; roles: FinalRole[]; players: Player[] }

export default function EndPanel({ roomId, meId, demoRecap, winner, roles, players }: Props) {
  const style = winner ? TEAM_STYLE[winner] : undefined
  const [fetched, setFetched] = useState<Recap | null>(null)
  const [failed, setFailed] = useState(false)
  const recap = roomId ? fetched : demoRecap ?? null

  // Récap commun à tous (exploits, bilan, nuit par nuit) ; fanfare si j'ai débloqué un trophée
  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    getGameRecap(roomId)
      .then((r) => {
        if (cancelled) return
        setFetched(r)
        if (r.players.some((p) => p.player_id === meId && p.new_trophies.length > 0)) setTimeout(() => playSfx('trophy'), 2500)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [roomId, meId])

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-5 text-center`}>
        <p className="text-sm uppercase tracking-widest text-mist-d">Fin de partie</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-paper">
          {winner === 'villageois' ? 'Les Villageois l’emportent !' : winner === 'saboteurs' ? 'Les Saboteurs l’emportent !' : 'Partie terminée'}
        </h2>
        {style && <p className={`mt-1 ${style.text}`}>{style.label}</p>}
      </section>

      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Les rôles</h2>
        {roles.length === 0 ? (
          <p className="mt-2 text-mist-d">Chargement…</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {roles.map((r) => {
              const p = players.find((x) => x.id === r.player_id)
              const role = getRole(r.role_id)
              const team = TEAM_STYLE[r.team as TeamId]
              return (
                <li key={r.player_id} className="flex items-center justify-between gap-3">
                  <span className={p && !p.is_alive ? 'text-mist-d line-through' : ''}>
                    {p ? <><Avatar index={p.avatar} look={p.look} scale={1} className="mr-1 inline align-middle" />{p.nickname}</> : 'Joueur'}
                  </span>
                  <span className={`text-right ${team?.text ?? ''}`}>
                    {role?.name ?? r.role_id}
                    {r.team === 'solitaires' && (
                      <span className={`block font-pixel text-[10px] uppercase ${r.solo_won ? 'text-gold' : 'text-mist-d'}`}>
                        {r.solo_won ? '✓ victoire personnelle' : '✗ objectif manqué'}
                        {r.role_id === 'opportuniste' && r.side ? ` · pari ${r.side === 'saboteurs' ? 'Saboteurs' : 'Villageois'}` : ''}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {recap ? <GameRecap recap={recap} players={players} meId={meId} />
        : roomId && !failed ? <p className="text-center text-sm text-mist-d">Chargement du récap…</p>
        : null}
    </div>
  )
}
