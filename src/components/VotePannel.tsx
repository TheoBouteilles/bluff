import { AVATARS } from '../data/avatars'
import type { Player } from '../types'
import { panelClass } from './ui'

type Props = {
  player: Player
  others: Player[] // joueurs vivants autres que player
  runoff?: { step: number; names: string[] } // départage après une égalité
  choice: string | null | undefined // undefined = pas encore voté, null = abstention
  onVote: (targetId: string | null) => void
}

const chip = (active: boolean) =>
  `flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition ${
    active
      ? 'border-amber-500 bg-amber-900/20 text-amber-100'
      : 'border-amber-800/40 bg-stone-900/80 hover:border-amber-600/60'
  }`

export default function VotePanel({ player, others, runoff, choice, onVote }: Props) {
  if (!player.is_alive) {
    return (
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Tu es spectateur</h2>
        <p className="mt-2 text-stone-400">Les éliminés ne votent plus. Observe la fin de la partie.</p>
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {runoff && (
        <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          ⚖️ Égalité ! Nouveau vote (départage n°{runoff.step}) entre <strong>{runoff.names.join(' et ')}</strong>.
        </p>
      )}
      <p className="text-sm text-stone-400">
        {player.is_bot ? `Vote de ${player.nickname} (bot) : ` : ''}
        qui veux-tu éliminer ? Ton vote est secret. Le plus voté est éliminé ; en cas d’égalité, on revote entre les ex æquo.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {others.map((p) => (
          <button key={p.id} type="button" onClick={() => onVote(p.id)} className={chip(choice === p.id)}>
            <span className="text-xl">{AVATARS[p.avatar].emoji}</span>
            <span className="font-semibold">{p.nickname}</span>
          </button>
        ))}
        <button type="button" onClick={() => onVote(null)} className={chip(choice === null)}>
          <span className="text-xl">🕊️</span>
          <span className="font-semibold">S’abstenir</span>
        </button>
      </div>
      <p className="text-center text-sm text-stone-400">
        {choice === undefined
          ? 'Sans vote, tu t’abstiens.'
          : 'Vote enregistré. Tu peux encore le changer avant le dépouillement.'}
      </p>
    </div>
  )
}
