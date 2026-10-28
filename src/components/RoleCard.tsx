import { AVATARS } from '../data/avatars'
import { TEAM_STYLE } from '../data/roles'
import type { Role } from '../data/roles'
import type { Player } from '../types'
import { TokenBadge } from './ui'

type Props = { role: Role; tokens: number; allies?: Player[] | null }

export default function RoleCard({ role, tokens, allies = [] }: Props) {
  const t = TEAM_STYLE[role.team]
  return (
    <div className={`rounded-2xl border-2 bg-stone-900/90 p-5 shadow-lg shadow-amber-900/20 ${t.border}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs font-bold uppercase tracking-widest ${t.text}`}>Camp : {t.label}</p>
        <TokenBadge count={tokens} />
      </div>
      <h2 className="mt-2 text-3xl font-bold text-amber-100">{role.name}</h2>
      <p className="mt-1 italic text-stone-400">{role.description}</p>
      <div className="mt-4 space-y-2 border-t border-amber-800/30 pt-4 text-sm">
        <p><span className="font-semibold text-amber-500">Pouvoir : </span>{role.power}</p>
        <p><span className="font-semibold text-amber-500">Victoire : </span>{role.victory}</p>
      </div>

      {role.team === 'saboteurs' && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm">
          <p className="font-semibold text-red-400">Tes complices</p>
          {allies === null ? (
            <p className="text-stone-400">Chargement…</p>
          ) : allies.length === 0 ? (
            <p className="text-stone-400">Tu es le seul Saboteur.</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {allies.map((a) => (
                <li key={a.id} className="rounded-full bg-stone-800 px-3 py-1">
                  {AVATARS[a.avatar].emoji} {a.nickname}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}