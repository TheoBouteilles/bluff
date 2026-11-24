import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Px } from './Px'
import { TEAM_STYLE } from '../data/roles'
import type { TeamId } from '../data/roles'
import type { Player } from '../types'

// Écrans de transition plein écran entre les phases (tombée de la nuit, aube, vote, élimination, fin).
// Affichés seulement quand le changement est vécu en direct ; un appui les ferme. Rien de secret n'y figure :
// uniquement ce que tout le monde apprend en même temps (morts, éliminé et son camp, vainqueur).

export type TransitionKind = 'night' | 'day' | 'vote' | 'runoff' | 'result' | 'ended'

type Props = {
  kind: TransitionKind
  round: number
  players: Player[]
  deaths?: string[] | null // aube : joueurs morts cette nuit (null = pas encore connu)
  eliminated?: { id: string | null; team: string | null } | null // résultat du vote (null = pas encore connu)
  runoffNames?: string[]
  winner?: string | null
  onDone: () => void
}

// Durées d'affichage (ms), allongées de 25 % après les parties tests pour laisser le temps de lire
const DURATION: Record<TransitionKind, number> = { night: 3250, day: 4250, vote: 2750, runoff: 3250, result: 4500, ended: 5250 }

const BG: Record<TransitionKind, string> = {
  night: 'linear-gradient(to bottom, #05080d 0, #05080d 30%, #0b1220 30%, #0b1220 60%, #101a2c 60%)',
  day: 'linear-gradient(to bottom, #241c36 0, #241c36 30%, #3d2a48 30%, #3d2a48 62%, #6e3a40 62%, #6e3a40 80%, #a8583a 80%, #a8583a 92%, #d98a4e 92%)',
  vote: 'linear-gradient(to bottom, #1b1410 0, #1b1410 35%, #2a1f18 35%)',
  runoff: 'linear-gradient(to bottom, #1b1410 0, #1b1410 35%, #2a1f18 35%)',
  result: 'linear-gradient(to bottom, #120c0a 0, #120c0a 40%, #1e1411 40%)',
  ended: 'linear-gradient(to bottom, #101820 0, #101820 40%, #182230 40%)',
}

export default function PhaseTransition({ kind, round, players, deaths, eliminated, runoffNames, winner, onDone }: Props) {
  const [leaving, setLeaving] = useState(false)
  // Le texte attend les données (morts, résultat) : la durée court à partir du moment où elles sont là
  const waiting = (kind === 'day' && deaths == null) || (kind === 'result' && eliminated == null)

  useEffect(() => {
    if (waiting) {
      const safety = setTimeout(() => setLeaving(true), 6000) // données jamais arrivées : on ne bloque pas l'écran
      return () => clearTimeout(safety)
    }
    const t1 = setTimeout(() => setLeaving(true), DURATION[kind])
    return () => clearTimeout(t1)
  }, [kind, waiting])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onDone, 380)
    return () => clearTimeout(t)
  }, [leaving, onDone])

  const nameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '?'
  const player = (id: string) => players.find((p) => p.id === id)

  let art: ReactNode = null
  let over = ''
  let title = ''
  let sub: ReactNode = null

  switch (kind) {
    case 'night':
      art = <Px name="moon" scale={8} className="animate-[tr-sink_1.2s_cubic-bezier(.2,.8,.3,1)_both]" />
      over = `Manche ${round}`
      title = 'La nuit tombe'
      sub = 'Choisis en secret où passer la nuit.'
      break
    case 'day':
      art = <Px name="sun" scale={8} className="animate-[tr-rise_1.4s_cubic-bezier(.2,.8,.3,1)_both]" />
      over = `Manche ${round}`
      title = 'L’aube se lève'
      sub = deaths == null ? '…'
        : deaths.length === 0 ? 'Tout le monde a survécu à la nuit.'
        : (
          <span className="flex flex-col items-center gap-2">
            <span className="flex justify-center gap-2">
              {deaths.map((id) => <Px key={id} name="skull" scale={3} className="animate-[tr-drop_500ms_900ms_steps(4)_both]" />)}
            </span>
            <span><strong className="text-paper">{deaths.map(nameOf).join(', ')}</strong> {deaths.length > 1 ? 'n’ont' : 'n’a'} pas survécu à la nuit.</span>
          </span>
        )
      break
    case 'vote':
      art = <Px name="crown" scale={7} className="animate-pop" />
      over = `Manche ${round}`
      title = 'Place au vote'
      sub = 'En secret. Le plus voté sera éliminé.'
      break
    case 'runoff':
      art = <Px name="crown" scale={7} className="animate-shake" />
      over = 'Égalité'
      title = 'Départage'
      sub = runoffNames?.length ? <>On revote entre <strong className="text-paper">{runoffNames.join(', ')}</strong>.</> : 'On revote entre les ex æquo.'
      break
    case 'result': {
      const p = eliminated?.id ? player(eliminated.id) : undefined
      const team = eliminated?.team ? TEAM_STYLE[eliminated.team as TeamId] : undefined
      art = eliminated == null ? <Px name="crown" scale={7} className="animate-float" />
        : p ? (
          <span className="relative inline-block">
            <Avatar index={p.avatar} look={p.look} kind="body" scale={5} animate={false} className="animate-[tr-fall_900ms_600ms_ease-in_both]" />
            <Px name="ghost" scale={5} className="absolute left-1/2 top-0 -translate-x-1/2 animate-[tr-ghost_1.2s_1.3s_ease-out_both]" />
          </span>
        )
        : <Px name="check" scale={7} className="animate-pop" />
      over = 'Le village a tranché'
      title = eliminated == null ? 'Dépouillement…' : p ? `${p.nickname} est éliminé` : 'Personne n’est éliminé'
      sub = p && team ? (
        <span className="animate-[tr-reveal_400ms_1.2s_steps(3)_both] inline-flex items-center gap-2">
          <Px name={`team_${eliminated?.team}_s`} scale={2} />
          <span>C’était <strong className={team.text}>{eliminated?.team === 'solitaires' ? 'un Solitaire' : eliminated?.team === 'saboteurs' ? 'un Saboteur' : 'un Villageois'}</strong>.</span>
        </span>
      ) : eliminated == null ? null : p ? null : 'Les voix se sont dispersées.'
      break
    }
    case 'ended': {
      const team = winner ? TEAM_STYLE[winner as TeamId] : undefined
      art = winner ? <Px name={`team_${winner}`} scale={5} className="animate-[tr-win_900ms_cubic-bezier(.2,1.6,.4,1)_both]" /> : <Px name="crown" scale={7} className="animate-pop" />
      over = 'Fin de partie'
      title = team ? `Victoire des ${team.label}` : 'Partie terminée'
      sub = winner === 'saboteurs' ? 'Le village est tombé entre leurs mains.' : winner === 'villageois' ? 'Le village est sauvé !' : null
      break
    }
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={title}
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 px-6 text-center transition-opacity duration-300 ${leaving ? 'opacity-0' : 'animate-[tr-in_300ms_ease-out_both]'}`}
      style={{ backgroundImage: BG[kind], backgroundColor: '#101820' }}
    >
      {/* Étoiles (nuit) ou rayons (aube) en pixels */}
      {kind === 'night' && <Stars />}
      {kind === 'ended' && winner && <Confetti color={winner === 'saboteurs' ? '#e8847c' : '#e6c25a'} />}

      <div className="relative flex h-28 items-end justify-center">{art}</div>
      <div className="relative flex flex-col items-center gap-2">
        <p className="animate-[tr-up_400ms_300ms_ease-out_both] font-pixel text-[12px] uppercase tracking-[0.3em] text-sand">{over}</p>
        <h2 className="animate-[tr-up_400ms_450ms_ease-out_both] font-display text-5xl font-bold uppercase leading-none tracking-wider text-paper [text-shadow:4px_4px_0_var(--color-ink)]">
          {title}
        </h2>
        {sub && <div className="animate-[tr-up_400ms_700ms_ease-out_both] max-w-xs font-sans text-sm text-mist">{sub}</div>}
      </div>
      <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] font-pixel text-[10px] uppercase tracking-widest text-mist-d/70">Touche pour continuer</p>
    </div>
  )
}

// Petites étoiles qui scintillent, positions fixes (pas d'aléatoire : même rendu à chaque fois)
function Stars() {
  const stars = [[8, 12], [22, 6], [37, 18], [52, 9], [68, 15], [83, 7], [91, 22], [14, 30], [46, 28], [76, 33], [60, 4], [30, 38]]
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {stars.map(([x, y], i) => (
        <span key={i} className="absolute h-1 w-1 bg-gold animate-[tr-twinkle_1.6s_steps(2)_infinite]" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 220}ms` }} />
      ))}
    </div>
  )
}

// Confettis carrés qui tombent (victoire)
function Confetti({ color }: { color: string }) {
  const bits = Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 173) % 1400, c: i % 3 === 0 ? '#f1e6cc' : color }))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} className="absolute -top-4 h-2 w-2 animate-[tr-confetti_2.6s_linear_infinite]" style={{ left: `${b.x}%`, background: b.c, animationDelay: `${b.d}ms` }} />
      ))}
    </div>
  )
}
