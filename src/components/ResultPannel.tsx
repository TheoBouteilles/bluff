import { AVATARS } from '../data/avatars'
import { TEAM_STYLE } from '../data/roles'
import type { TeamId } from '../data/roles'
import type { VoteResult } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

type Props = { result: VoteResult | undefined; players: Player[] }

export default function ResultPanel({ result, players }: Props) {
  if (!result) return <p className="text-center text-stone-400">Chargement…</p>
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? `${AVATARS[p.avatar].emoji} ${p.nickname}` : 'Quelqu’un'
  }
  const eliminated = result.eliminated_id ? nameOf(result.eliminated_id) : null
  const team = result.eliminated_team ? TEAM_STYLE[result.eliminated_team as TeamId] : undefined
  const tally = Object.entries(result.tally).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Résultat du vote</h2>
        {eliminated ? (
          <>
            <p className="mt-2">
              <strong className="text-amber-300">{eliminated}</strong> est éliminé.
            </p>
            {result.runoffs > 0 && (
              <p className="mt-1 text-sm text-stone-400">
                Après {result.runoffs} revote{result.runoffs > 1 ? 's' : ''} pour départager des égalités
                {result.drawn ? ' puis un tirage au sort entre les derniers ex æquo.' : '.'}
              </p>
            )}
            {team && (
              <p className="mt-1">
                Il faisait partie du camp : <strong className={team.text}>{team.label}</strong>.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-stone-300">
            {result.tied ? 'Égalité : personne n’est éliminé.' : 'Aucun vote exprimé : personne n’est éliminé.'}
          </p>
        )}
      </section>

      {tally.length > 0 && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-amber-100">Voix reçues</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {tally.map(([id, n]) => (
              <li key={id} className="flex justify-between">
                <span>{nameOf(id)}</span>
                <span className="text-amber-300">{n} voix</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Les votes restent secrets : seul le total par joueur est public.</p>
        </section>
      )}
    </div>
  )
}
