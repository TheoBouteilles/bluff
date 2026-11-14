import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Px } from './Px'
import { TEAM_STYLE, getRole } from '../data/roles'
import type { TeamId } from '../data/roles'
import { getTrophy } from '../data/trophies'
import { getNewTrophies } from '../lib/api'
import { playSfx } from '../lib/audio'
import type { FinalRole } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

// roomId absent (vitrine /demo) : pas d'appel, on affiche demoTrophies
type Props = { roomId?: string; demoTrophies?: string[]; winner: 'villageois' | 'saboteurs' | null; roles: FinalRole[]; players: Player[] }

export default function EndPanel({ roomId, demoTrophies = [], winner, roles, players }: Props) {
  const style = winner ? TEAM_STYLE[winner] : undefined
  const [fetched, setFetched] = useState<string[]>([])
  const trophies = roomId ? fetched : demoTrophies

  // Trophées débloqués pendant cette partie (rien en mode debug)
  useEffect(() => {
    if (roomId) {
      getNewTrophies(roomId)
        .then((t) => {
          setFetched(t)
          if (t.length > 0) setTimeout(() => playSfx('trophy'), 2500) // après la fanfare de fin
        })
        .catch(() => setFetched([]))
    }
  }, [roomId])

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-5 text-center`}>
        <p className="text-sm uppercase tracking-widest text-mist-d">Fin de partie</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-paper">
          {winner === 'villageois' ? 'Les Villageois l’emportent !' : winner === 'saboteurs' ? 'Les Saboteurs l’emportent !' : 'Partie terminée'}
        </h2>
        {style && <p className={`mt-1 ${style.text}`}>{style.label}</p>}
      </section>

      {trophies.length > 0 && (
        <section className="px-frame-paper p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider">
            <Px name="crown" scale={2} /> Trophées débloqués
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {trophies.map((id) => {
              const t = getTrophy(id)
              return (
                <li key={id} className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{t?.emoji ?? '🏆'}</span>
                  <span>
                    <span className="block font-pixel text-[11px] uppercase tracking-wide">{t?.name ?? id}</span>
                    {t && <span className="block font-sans text-xs text-ink/70">{t.description}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link to="/stats" className="mt-3 block text-center font-pixel text-[11px] uppercase tracking-wide underline decoration-2 underline-offset-4">
            Voir mes statistiques ▸
          </Link>
        </section>
      )}

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
    </div>
  )
}
