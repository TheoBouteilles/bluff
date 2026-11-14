import { Avatar, Px } from './Px'
import { TEAM_STYLE } from '../data/roles'
import type { Role } from '../data/roles'
import type { Player } from '../types'
import { TokenBadge } from './ui'

type Props = { role: Role; tokens: number; allies?: Player[] | null }

// Carte de rôle façon ticket perforé : bandeau de camp, emblème pixel, pouvoir et victoire
export default function RoleCard({ role, tokens, allies = [] }: Props) {
  const t = TEAM_STYLE[role.team]
  const paper = role.team !== 'saboteurs'
  const bg = paper ? 'bg-paper text-ink' : 'bg-blood-d text-paper'
  const band = { villageois: 'bg-sea text-paper', saboteurs: 'bg-blood text-paper', solitaires: 'bg-moss text-paper' }[role.team]
  const rule = paper ? 'border-ink/25' : 'border-paper/25'
  const muted = paper ? 'text-ink/60' : 'text-paper/70'

  return (
    <div className="animate-pop" style={{ filter: 'drop-shadow(4px 4px 0 var(--color-ink))' }}>
      <div className={`px-ticket border-3 border-ink ${bg}`} style={{ ['--notch-y' as string]: '112px' }}>
        <div className={`flex items-center justify-between gap-3 border-b-3 border-ink px-4 py-2 ${band}`}>
          <p className="flex items-center gap-2 font-pixel text-[11px] uppercase tracking-[0.2em]">
            <Px name={`team_${role.team}_s`} scale={2} /> Camp {t.label}
          </p>
          <TokenBadge count={tokens} />
        </div>

        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <Px name={`team_${role.team}`} scale={2} className="animate-float shrink-0" />
          <div>
            <h2 className="font-display text-3xl font-bold leading-none">{role.name}</h2>
            <p className={`mt-2 font-sans text-sm italic ${muted}`}>{role.description}</p>
          </div>
        </div>

        <div className={`mx-4 border-t-2 border-dashed ${rule}`} />

        <div className="space-y-3 px-4 py-4 font-sans text-sm">
          <p><span className={`font-pixel text-[10px] uppercase tracking-wider ${paper ? 'text-sea' : 'text-gold'}`}>Pouvoir</span><br />{role.power}</p>
          <p><span className={`font-pixel text-[10px] uppercase tracking-wider ${paper ? 'text-sea' : 'text-gold'}`}>Victoire</span><br />{role.victory}</p>
        </div>

        {role.team === 'saboteurs' && (
          <div className="border-t-3 border-ink bg-ink/30 px-4 py-3 font-sans text-sm">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-gold">Tes complices</p>
            {allies === null ? (
              <p className={muted}>Chargement…</p>
            ) : allies.length === 0 ? (
              <p className={muted}>Tu es le seul Saboteur.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-3">
                {allies.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 border-2 border-ink bg-night px-2 py-1 text-paper">
                    <Avatar index={a.avatar} look={a.look} scale={2} /> {a.nickname}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
