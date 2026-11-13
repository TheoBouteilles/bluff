import { useState } from 'react'
import { Avatar } from './Px'
import type { Player } from '../types'
import { panelClass } from './ui'

type Props = {
  player: Player
  others: Player[] // joueurs vivants autres que player
  runoff?: { step: number; names: string[] } // départage après une égalité
  choice: string | null | undefined // undefined = pas encore voté, null = abstention
  onVote: (targetId: string | null) => Promise<void> | void // valide le vote
  onCancel: () => Promise<void> | void // « Retour »
}

const chip = (active: boolean) =>
  `flex items-center gap-2 border-2 px-4 py-3 text-left transition ${
    active
      ? 'border-ink bg-paper text-ink'
      : 'border-night-3 bg-night-2 hover:border-gold'
  }`

export default function VotePanel({ player, others, runoff, choice, onVote, onCancel }: Props) {
  const [draft, setDraft] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const validated = choice !== undefined
  const current = validated ? choice : draft
  const pick = (id: string | null) => { if (!validated) setDraft(id) }
  async function validate() {
    if (current === undefined || busy) return
    setBusy(true)
    try { await onVote(current) } finally { setBusy(false) }
  }
  async function back() {
    if (busy) return
    setBusy(true)
    setDraft(choice)
    try { await onCancel() } finally { setBusy(false) }
  }
  if (!player.is_alive) {
    return (
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Tu es spectateur</h2>
        <p className="mt-2 text-mist-d">Les éliminés ne votent plus. Observe la fin de la partie.</p>
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {runoff && (
        <p className="border border-blood bg-blood/15 p-3 text-sm text-[#f0b4ae]">
          ⚖️ Égalité ! Nouveau vote (départage n°{runoff.step}) entre <strong>{runoff.names.join(' et ')}</strong>.
        </p>
      )}
      <p className="font-sans text-sm text-mist-d">
        {player.is_bot ? `Vote de ${player.nickname} (bot) : ` : ''}
        Qui veux-tu éliminer ? Ton vote est secret. Le plus voté est éliminé ; en cas d’égalité, on revote entre les ex æquo.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {others.map((p) => (
          <button key={p.id} type="button" onClick={() => pick(p.id)} className={chip(current === p.id)}>
            <Avatar index={p.avatar} scale={2} />
            <span className="font-semibold">{p.nickname}</span>
          </button>
        ))}
        <button type="button" onClick={() => pick(null)} className={chip(current === null)}>
          <span className="text-xl">🕊️</span>
          <span className="font-semibold">S’abstenir</span>
        </button>
      </div>
      {validated ? (
        <div className="flex flex-col gap-2">
          <p className="border border-moss bg-moss/20 p-3 text-center text-sm text-[#bfe9dc]">
            ✅ Vote validé. En attente des autres joueurs…
          </p>
          <button type="button" onClick={back} disabled={busy} className="px-frame px-press px-4 py-3 font-pixel text-[13px] uppercase tracking-wide text-paper hover:!bg-night-3 disabled:opacity-40">
            ↩ Retour (modifier mon vote)
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={validate}
          disabled={current === undefined || busy}
          className="px-frame px-press !bg-paper px-4 py-3 font-pixel text-[13px] uppercase tracking-wide text-ink [box-shadow:inset_0_0_0_2px_#fff8e6,4px_4px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {current === undefined ? 'Choisis pour valider' : 'Valider mon vote'}
        </button>
      )}
    </div>
  )
}
