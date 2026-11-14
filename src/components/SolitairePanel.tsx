import { useState } from 'react'
import { Px } from './Px'
import { TEAM_STYLE } from '../data/roles'
import type { PlayerSecret } from '../types'
import { Label } from './ui'

type Side = 'villageois' | 'saboteurs'

type Props = {
  secret: PlayerSecret
  alive: boolean
  canAct: boolean // nuit en cours : l'Opportuniste peut parier ou changer de camp
  goal: number // objectif du Capitaliste
  switchCost: number // coût d'un changement de camp
  onSide: (side: Side) => Promise<void> | void
}

// Objectif personnel d'un Solitaire, affiché au-dessus de son action (privé, sur son écran)
export default function SolitairePanel({ secret, alive, canAct, goal, switchCost, onSide }: Props) {
  const [busy, setBusy] = useState(false)

  if (secret.role_id === 'capitaliste') {
    const pct = Math.min(100, Math.round((100 * secret.tokens) / Math.max(1, goal)))
    return (
      <section className="px-frame border-l-8 border-moss p-4">
        <Label>Ton objectif de Capitaliste</Label>
        {secret.solo_won ? (
          <p className="mt-2 font-display text-2xl font-bold text-gold">
            <Px name="crown" scale={2} className="mr-2 align-[-2px]" />Objectif atteint, ta victoire est acquise !
          </p>
        ) : (
          <>
            <p className="mt-1 font-sans text-sm text-mist">Détenir {goal} jetons à un moment de la partie.</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="px-inset h-4 flex-1 bg-night">
                <span className="block h-full bg-gold" style={{ width: `${pct}%` }} />
              </span>
              <span className="font-display text-xl font-bold text-paper">{secret.tokens}/{goal}</span>
            </div>
          </>
        )}
      </section>
    )
  }

  if (secret.role_id !== 'opportuniste') return null
  const side = secret.side ?? null
  const cost = side ? switchCost : 0
  const enough = secret.tokens >= cost

  async function pick(s: Side) {
    if (busy || s === side) return
    if (side && !window.confirm(`Changer de camp pour ${switchCost} jeton${switchCost > 1 ? 's' : ''} ?`)) return
    setBusy(true)
    try { await onSide(s) } finally { setBusy(false) }
  }

  return (
    <section className="px-frame border-l-8 border-moss p-4">
      <Label>Ton pari d’Opportuniste</Label>
      <p className="mt-1 font-sans text-sm text-mist">
        {side
          ? <>Tu paries sur les <strong className={TEAM_STYLE[side].text}>{TEAM_STYLE[side].label}</strong>. Survis et que ce camp gagne !</>
          : 'Choisis le camp qui va gagner (premier choix gratuit). Sans pari à la fin, tu perds.'}
      </p>
      {alive && canAct ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['villageois', 'saboteurs'] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || (s !== side && !enough)}
                onClick={() => pick(s)}
                className={`flex items-center justify-center gap-2 border-2 px-3 py-2 font-pixel text-[12px] uppercase tracking-wide disabled:opacity-40 ${
                  s === side ? 'border-ink bg-paper text-ink' : 'border-night-3 bg-night text-paper hover:border-gold'
                }`}
              >
                <Px name={`team_${s}_s`} scale={2} /> {TEAM_STYLE[s].label}
              </button>
            ))}
          </div>
          {side && (
            <p className="mt-2 font-sans text-xs text-mist-d">
              Changer de camp : {switchCost} jeton{switchCost > 1 ? 's' : ''}{!enough && ' (pas assez de jetons)'}.
            </p>
          )}
        </>
      ) : (
        alive && <p className="mt-2 font-sans text-xs text-mist-d">Tu pourras changer de camp pendant la nuit.</p>
      )}
    </section>
  )
}
