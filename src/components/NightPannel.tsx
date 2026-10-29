import { useState } from 'react'
import type { ReactNode } from 'react'
import { AVATARS } from '../data/avatars'
import { COSTS, rumeurCost } from '../data/costs'
import { LOCATIONS } from '../data/locations'
import VillageMap from './VillageMap'
import type { NightParams } from '../lib/api'
import type { NightChoice } from '../hooks/useNightChoices'
import type { Player } from '../types'

type Props = {
  player: Player
  others: Player[] // joueurs vivants autres que player
  tokens: number
  isSaboteur: boolean
  choice?: NightChoice
  closed: string[]
  onChoose: (locationId: string, params?: NightParams) => void
}

const chip = (active: boolean, disabled = false) =>
  `rounded-full px-3 py-1 text-sm transition ${
    active ? 'bg-amber-600 text-stone-950' : 'bg-stone-800 text-stone-200 hover:bg-stone-700'
  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`

function Options({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="-mt-1 flex flex-col gap-2 rounded-xl border border-amber-800/40 bg-stone-950/60 p-3">
      <p className="text-xs uppercase tracking-wider text-stone-500">{title}</p>
      {children}
    </div>
  )
}

export default function NightPanel({ player, others, tokens, isSaboteur, choice, closed, onChoose }: Props) {
  const [rumTargets, setRumTargets] = useState<string[]>([])
  const [rumOpen, setRumOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState<string | null>(null)
  const loc = choice?.location
  const selectedLoc = LOCATIONS.find((l) => l.id === loc)
  const rulesInfo = LOCATIONS.find((l) => l.id === rulesOpen)
  const params = choice?.params ?? {}

  const playerChip = (p: Player, active: boolean, onClick: () => void) => (
    <button key={p.id} type="button" onClick={onClick} className={chip(active)}>
      {AVATARS[p.avatar].emoji} {p.nickname}
    </button>
  )

  const toggleRum = (id: string) =>
    setRumTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 3 ? t : [...t, id]))

  function options(id: string): ReactNode {
    if (id === 'casino') {
      const stake = params.stake ?? 0
      return (
        <Options title={`Mise (une chance sur 2 de doubler, max ${COSTS.casinoMax})`}>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: COSTS.casinoMax + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                disabled={n > tokens}
                onClick={() => onChoose('casino', { stake: n })}
                className={chip(stake === n, n > tokens)}
              >
                {n === 0 ? 'Ne pas miser' : `${n} jeton${n > 1 ? 's' : ''}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">Perdu : la mise est perdue. Gagné : tu récupères le double.</p>
        </Options>
      )
    }
    if (id === 'taverne') {
      const action = params.action ?? 'none'
      return (
        <Options title="À la taverne">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(action === 'none' && !rumOpen)}
              onClick={() => {
                setRumOpen(false)
                onChoose('taverne', { action: 'none' })
              }}
            >
              Juste boire un verre
            </button>
            <button
              type="button"
              disabled={tokens < COSTS.don}
              className={chip(action === 'don', tokens < COSTS.don)}
              onClick={() => {
                setRumOpen(false)
                onChoose('taverne', { action: 'don', target: others[0]?.id })
              }}
            >
              Offrir {COSTS.don} jeton
            </button>
            <button
              type="button"
              disabled={tokens < COSTS.rumeur3}
              className={chip(action === 'rumeur' || rumOpen, tokens < COSTS.rumeur3)}
              onClick={() => {
                setRumOpen(true)
                setRumTargets(params.targets ?? [])
                if (action !== 'rumeur') onChoose('taverne', { action: 'none' })
              }}
            >
              Acheter une rumeur
            </button>
          </div>

          {action === 'don' && (
            <>
              <p className="text-xs text-stone-500">Cadeau secret, reçu seulement si le receveur est aussi à la Taverne cette nuit. Sinon il échoue (jeton conservé).</p>
              <div className="flex flex-wrap gap-2">
                {others.map((p) => playerChip(p, params.target === p.id, () => onChoose('taverne', { action: 'don', target: p.id })))}
              </div>
            </>
          )}

          <RumeurPicker
            show={action === 'rumeur' || rumOpen}
            others={others}
            tokens={tokens}
            targets={rumTargets}
            onToggle={toggleRum}
            onBuy={() => onChoose('taverne', { action: 'rumeur', targets: rumTargets })}
            active={action === 'rumeur'}
            savedTargets={params.targets}
            playerChip={playerChip}
          />
        </Options>
      )
    }
    if (id === 'poste_garde') {
      return (
        <Options title={`Enquêter sur un joueur (${COSTS.posteGarde} jetons)`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!params.target)} onClick={() => onChoose('poste_garde', {})}>
              Ne pas enquêter
            </button>
            {others.map((p) =>
              tokens < COSTS.posteGarde ? null : playerChip(p, params.target === p.id, () => onChoose('poste_garde', { target: p.id })),
            )}
          </div>
          {tokens < COSTS.posteGarde && <p className="text-xs text-stone-500">Il te faut {COSTS.posteGarde} jetons pour enquêter.</p>}
          <p className="text-xs text-stone-500">Tu apprends où ce joueur a passé la nuit.</p>
        </Options>
      )
    }
    if (id === 'mairie') {
      const rig = params.rig
      return (
        <Options title={`Truquer le vote (${COSTS.mairie} jetons)`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!rig)} onClick={() => onChoose('mairie', {})}>
              Ne rien truquer
            </button>
            <button
              type="button"
              disabled={tokens < COSTS.mairie}
              className={chip(rig === 'shield', tokens < COSTS.mairie)}
              onClick={() => onChoose('mairie', { rig: 'shield' })}
            >
              Annuler les voix contre moi
            </button>
            <button
              type="button"
              disabled={tokens < COSTS.mairie}
              className={chip(rig === 'boost', tokens < COSTS.mairie)}
              onClick={() => onChoose('mairie', { rig: 'boost', target: params.target ?? others[0]?.id })}
            >
              +2 voix contre un joueur
            </button>
          </div>
          {rig === 'boost' && (
            <div className="flex flex-wrap gap-2">
              {others.map((p) => playerChip(p, params.target === p.id, () => onChoose('mairie', { rig: 'boost', target: p.id })))}
            </div>
          )}
          <p className="text-xs text-stone-500">
            Échec (jetons perdus) si un autre joueur est aussi à la Mairie cette nuit.
          </p>
        </Options>
      )
    }
    if (id === 'planque' && isSaboteur) {
      const sab = params.sabotage
      const targets = LOCATIONS.filter((l) => ['casino', 'taverne', 'poste_garde'].includes(l.id))
      return (
        <Options title={`Saboteurs : fermer un lieu la nuit prochaine (${COSTS.planque} jetons)`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!sab)} onClick={() => onChoose('planque', {})}>
              Ne rien saboter
            </button>
            {targets.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={tokens < COSTS.planque}
                className={chip(sab === l.id, tokens < COSTS.planque)}
                onClick={() => onChoose('planque', { sabotage: l.id })}
              >
                {l.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">
            Échec (jetons perdus) si un joueur hors Saboteurs se trouve aussi à la Planque cette nuit.
          </p>
        </Options>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone-400">
        {player.is_bot ? `Nuit de ${player.nickname} (bot) : ` : ''}
        choisis où passer la nuit. Ton choix est secret.
      </p>

      {closed.length > 0 && (
        <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
          Fermé cette nuit : {closed.map((c) => LOCATIONS.find((l) => l.id === c)?.name ?? c).join(', ')}.
        </p>
      )}

      <VillageMap
        selected={loc}
        closed={closed}
        onSelect={(id) => onChoose(id, {})}
        onInfo={(id) => setRulesOpen(rulesOpen === id ? null : id)}
      />

      {rulesInfo && (
        <section className="flex flex-col gap-2 rounded-xl border border-amber-800/40 bg-stone-950/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-amber-100">Règles : {rulesInfo.name}</h3>
            <button type="button" onClick={() => setRulesOpen(null)} className="text-sm text-stone-400 underline hover:text-amber-200">
              Fermer
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-stone-300">
            {rulesInfo.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {!closed.includes(rulesInfo.id) && loc !== rulesInfo.id && (
            <button type="button" onClick={() => onChoose(rulesInfo.id, {})} className={chip(false)}>
              Aller à : {rulesInfo.name}
            </button>
          )}
        </section>
      )}

      {selectedLoc ? (
        <section className="flex items-start gap-3 rounded-xl border border-amber-500 bg-amber-900/20 p-4">
          <selectedLoc.icon className="mt-0.5 shrink-0 text-amber-500" size={26} />
          <div>
            <p className="font-display text-lg font-bold text-amber-100">{selectedLoc.name}</p>
            <p className="text-sm text-stone-300">{selectedLoc.description}</p>
            <p className="mt-1 text-xs text-stone-500">
              {selectedLoc.visibleCrossing
                ? 'Tu verras qui s’y trouve, et ils te verront.'
                : 'Discret : personne ne te voit, et tu ne vois personne.'}
            </p>
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-stone-400">Touche un bâtiment pour y passer la nuit. Le « i » affiche les règles du lieu.</p>
      )}

      {loc && options(loc)}

      <p className="text-center text-sm text-stone-400">
        {loc
          ? 'Choix enregistré. Tu peux encore le changer avant la fin de la nuit.'
          : 'Sans choix, tu resteras chez toi.'}
      </p>
    </div>
  )
}

type RumeurProps = {
  show: boolean
  others: Player[]
  tokens: number
  targets: string[]
  onToggle: (id: string) => void
  onBuy: () => void
  active: boolean
  savedTargets?: string[]
  playerChip: (p: Player, active: boolean, onClick: () => void) => ReactNode
}

function RumeurPicker({ show, others, tokens, targets, onToggle, onBuy, active, savedTargets, playerChip }: RumeurProps) {
  if (!show && !active) return null
  const n = targets.length
  const valid = n === 2 || n === 3
  const cost = valid ? rumeurCost(n) : COSTS.rumeur3
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-stone-500">
        Choisis 2 ou 3 joueurs : tu sauras si au moins un Saboteur se cache parmi eux. Groupe de 3 : {COSTS.rumeur3} jeton, groupe de 2 : {COSTS.rumeur2} jetons.
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((p) => playerChip(p, targets.includes(p.id), () => onToggle(p.id)))}
      </div>
      <button
        type="button"
        disabled={!valid || tokens < cost}
        onClick={onBuy}
        className={chip(false, !valid || tokens < cost)}
      >
        {valid ? `Valider la rumeur (${cost} jeton${cost > 1 ? 's' : ''})` : 'Choisis 2 ou 3 joueurs'}
      </button>
      {active && savedTargets && <p className="text-xs text-amber-400">Rumeur enregistrée.</p>}
    </div>
  )
}
