import { useState } from 'react'
import type { ReactNode } from 'react'
import { AVATARS } from '../data/avatars'
import { COSTS, isSmallGame, rumeurCost } from '../data/costs'
import { LOCATIONS } from '../data/locations'
import VillageMap from './VillageMap'
import type { NightParams } from '../lib/api'
import type { NightChoice } from '../hooks/useNightChoices'
import type { Player } from '../types'

type Props = {
  player: Player
  others: Player[] // joueurs vivants autres que player
  tokens: number
  totalPlayers: number
  isSaboteur: boolean
  choice?: NightChoice
  closed: string[]
  onValidate: (locationId: string, params: NightParams) => Promise<void> | void
  onCancel: () => Promise<void> | void
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

export default function NightPanel({ player, others, tokens, totalPlayers, isSaboteur, choice, closed, onValidate, onCancel }: Props) {
  // Brouillon local : rien n'est enregistré avant « Valider ». Une fois validé, le choix est verrouillé jusqu'à « Retour ».
  const [draft, setDraft] = useState<NightChoice | null>(null)
  const validated = !!choice
  const current = validated ? choice : draft
  const onChoose = (location: string, p: NightParams = {}) => {
    if (!validated) setDraft({ location, params: p } as NightChoice)
  }
  const [busy, setBusy] = useState(false)
  async function validate() {
    if (!current || busy) return
    setBusy(true)
    try { await onValidate(current.location, current.params ?? {}) } finally { setBusy(false) }
  }
  async function back() {
    if (busy) return
    setBusy(true)
    setDraft(choice ?? null)
    try { await onCancel() } finally { setBusy(false) }
  }
  const [rumTargets, setRumTargets] = useState<string[]>([])
  const [rumOpen, setRumOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState<string | null>(null)
  const loc = current?.location
  const selectedLoc = LOCATIONS.find((l) => l.id === loc)
  const rulesInfo = LOCATIONS.find((l) => l.id === rulesOpen)
  const params = current?.params ?? {}

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
              disabled={tokens < (isSmallGame(totalPlayers) ? COSTS.rumeurSmall : COSTS.rumeur3)}
              className={chip(action === 'rumeur' || rumOpen, tokens < (isSmallGame(totalPlayers) ? COSTS.rumeurSmall : COSTS.rumeur3))}
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
            totalPlayers={totalPlayers}
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
              +{COSTS.mairieBoost} voix contre un joueur
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
      const targets = LOCATIONS.filter((l) => ['casino', 'taverne', 'poste_garde', 'mairie'].includes(l.id))
      return (
        <Options title={`Saboteurs : saboter un lieu en secret cette nuit (${COSTS.planque} jetons)`}>
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
            Casino : mises perdues. Taverne : rumeurs fausses. Poste de Garde : lieu faux. Mairie : le tricheur reçoit une voix contre lui. Échec (jetons perdus) si un joueur hors Saboteurs se trouve aussi à la Planque.
          </p>
        </Options>
      )
    }
    if (id === 'cimetiere') {
      const tomb = params.tomb
      const canPay = tokens >= COSTS.cimetiere
      return (
        <Options title={`Choisir une tombe (${COSTS.cimetiere} jeton${COSTS.cimetiere > 1 ? 's' : ''}) : si un fantôme l’a choisie, tu apprends son suspect`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChoose('cimetiere', {})} className={chip(tomb === undefined)}>
              Aucune (gratuit)
            </button>
            {Array.from({ length: COSTS.tombCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={!canPay}
                onClick={() => onChoose('cimetiere', { tomb: n })}
                className={chip(tomb === n, !canPay)}
              >
                🪦 Tombe {n}
              </button>
            ))}
          </div>
          {!canPay && <p className="text-xs text-stone-500">Il te faut {COSTS.cimetiere} jeton pour choisir une tombe.</p>}
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

      {loc && <div className={validated ? 'pointer-events-none opacity-60' : ''}>{options(loc)}</div>}

      {validated ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3 text-center text-sm text-emerald-200">
            ✅ Choix validé : {selectedLoc?.name}. En attente des autres joueurs…
          </p>
          <button type="button" onClick={back} disabled={busy} className="rounded-xl border border-amber-800/40 px-4 py-3 font-semibold text-amber-100 hover:border-amber-600/60 disabled:opacity-40">
            ↩ Retour (modifier mon choix)
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={validate}
          disabled={!loc || busy || (loc === 'taverne' && rumOpen && params.action !== 'rumeur')}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loc ? `Valider : ${selectedLoc?.name}` : 'Choisis un lieu pour valider'}
        </button>
      )}
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
  totalPlayers: number
}

function RumeurPicker({ show, others, tokens, targets, onToggle, onBuy, active, savedTargets, playerChip, totalPlayers }: RumeurProps) {
  if (!show && !active) return null
  const small = isSmallGame(totalPlayers)
  const n = targets.length
  const valid = small ? n === 3 : n === 2 || n === 3
  const cost = valid ? rumeurCost(n, totalPlayers) : small ? COSTS.rumeurSmall : COSTS.rumeur3
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-stone-500">
        {small
          ? `Petite partie : choisis exactement 3 joueurs, tu sauras si au moins un Saboteur se cache parmi eux (${COSTS.rumeurSmall} jetons).`
          : `Choisis 2 ou 3 joueurs : tu sauras si au moins un Saboteur se cache parmi eux. Groupe de 3 : ${COSTS.rumeur3} jeton, groupe de 2 : ${COSTS.rumeur2} jetons.`}
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
        {valid ? `Choisir cette rumeur (${cost} jeton${cost > 1 ? 's' : ''})` : small ? 'Choisis 3 joueurs' : 'Choisis 2 ou 3 joueurs'}
      </button>
      {active && savedTargets && <p className="text-xs text-amber-400">Rumeur sélectionnée.</p>}
    </div>
  )
}
