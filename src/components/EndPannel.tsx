import { Avatar } from './Px'
import { TEAM_STYLE, getRole } from '../data/roles'
import type { TeamId } from '../data/roles'
import type { FinalRole } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

type Props = { winner: 'villageois' | 'saboteurs' | null; roles: FinalRole[]; players: Player[] }

export default function EndPanel({ winner, roles, players }: Props) {
  const style = winner ? TEAM_STYLE[winner] : undefined
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
                    {p ? <><Avatar index={p.avatar} scale={1} className="mr-1 inline align-middle" />{p.nickname}</> : 'Joueur'}
                  </span>
                  <span className={team?.text}>{role?.name ?? r.role_id}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
