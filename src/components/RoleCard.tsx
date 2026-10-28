import { TEAM_STYLE } from '../data/roles'
import type { Role } from '../data/roles'

export default function RoleCard({ role, tokens }: { role: Role; tokens: number }) {
  const t = TEAM_STYLE[role.team]
  return (
    <div className={`rounded-2xl border-2 bg-slate-900 p-5 ${t.border}`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${t.text}`}>Camp : {t.label}</p>
      <h2 className="mt-1 text-3xl font-bold">{role.name}</h2>
      <p className="mt-1 text-slate-400">{role.description}</p>
      <div className="mt-4 space-y-2 text-sm">
        <p><span className="text-slate-500">Pouvoir : </span>{role.power}</p>
        <p><span className="text-slate-500">Victoire : </span>{role.victory}</p>
      </div>
      <p className="mt-4 text-lg font-semibold">
        🪙 {tokens} jeton{tokens > 1 ? 's' : ''}
      </p>
    </div>
  )
}