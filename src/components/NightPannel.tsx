import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Px } from './Px'
import LocationCard from './LocationCard'
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
  ghosts: Player[] // fantômes consultables au Cimetière (mode nominatif)
  namedCemetery: boolean
  allyInfo?: { name: string; location: string | null; validated: boolean; haunted: string[] }[] // vision des Saboteurs
  onDraft?: (locationId: string | null) => void // partage le lieu envisagé avec les alliés Saboteurs
  onValidate: (locationId: string, params: NightParams) => Promise<void> | void
  onCancel: () => Promise<void> | void
}

const chip = (active: boolean, disabled = false) =>
  `border-2 px-3 py-1 font-sans text-sm transition ${
    active ? 'border-ink bg-ink text-paper' : 'border-ink/40 bg-paper-2 text-ink hover:border-ink'
  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`

function Options({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-xs font-semibold text-ink">{title}</p>
      {children}
    </div>
  )
}

export default function NightPanel({ player, others, tokens, totalPlayers, isSaboteur, choice, closed, ghosts, namedCemetery, allyInfo, onDraft, onValidate, onCancel }: Props) {
  // Brouillon local : rien n'est enregistré avant « Valider ». Une fois validé, le choix est verrouillé jusqu'à « Retour ».
  const [draft, setDraft] = useState<NightChoice | null>(null)
  const validated = !!choice
  const current = validated ? choice : draft
  const onChoose = (location: string, p: NightParams = {}) => {
    if (!validated) {
      setDraft({ location, params: p } as NightChoice)
      if (location !== draft?.location) onDraft?.(location)
    }
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
    if (choice) onDraft?.(choice.location)
    try { await onCancel() } finally { setBusy(false) }
  }
  const [rumTargets, setRumTargets] = useState<string[]>([])
  const [rumOpen, setRumOpen] = useState(false)
  const loc = current?.location
  const selectedLoc = LOCATIONS.find((l) => l.id === loc)
  const params = current?.params ?? {}

  const playerChip = (p: Player, active: boolean, onClick: () => void) => (
    <button key={p.id} type="button" onClick={onClick} className={chip(active)}>
      <Avatar index={p.avatar} scale={1} className="mr-1 inline align-middle" />{p.nickname}
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
          <p className="text-xs text-ink/60">Perdu : la mise est perdue. Gagné : tu récupères le double.</p>
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
                onChoose('taverne', { action: 'don' })
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
              <p className="text-xs text-ink/60">Cadeau secret, reçu seulement si le receveur est aussi à la Taverne cette nuit. Sinon il échoue (jeton conservé).</p>
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
          {tokens < COSTS.posteGarde && <p className="text-xs text-ink/60">Il te faut {COSTS.posteGarde} jetons pour enquêter.</p>}
          <p className="text-xs text-ink/60">Tu apprends où ce joueur a passé la nuit.</p>
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
              onClick={() => onChoose('mairie', { rig: 'boost' })}
            >
              +{COSTS.mairieBoost} voix contre un joueur
            </button>
          </div>
          {rig === 'boost' && (
            <div className="flex flex-wrap gap-2">
              {!params.target && <p className="w-full text-xs font-semibold text-gold-d">Choisis le joueur visé :</p>}
              {others.map((p) => playerChip(p, params.target === p.id, () => onChoose('mairie', { rig: 'boost', target: p.id })))}
            </div>
          )}
          <p className="text-xs text-ink/60">
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
          <p className="text-xs text-ink/60">
            Casino : mises perdues. Taverne : rumeurs fausses. Poste de Garde : lieu faux. Mairie : le tricheur reçoit une voix contre lui. Le meurtre de la Planque passe d’abord : échec (jetons perdus) si un joueur hors Saboteurs y reste en vie. Deux Saboteurs sur le même lieu : un seul paie.
          </p>
        </Options>
      )
    }
    if (id === 'cimetiere' && namedCemetery) {
      const canPay = tokens >= COSTS.cimetiere
      return (
        <Options title={`Interroger un fantôme (${COSTS.cimetiere} jeton${COSTS.cimetiere > 1 ? 's' : ''}) : il te confie son suspect`}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChoose('cimetiere', {})} className={chip(!params.ghost)}>
              Personne (gratuit)
            </button>
            {ghosts.map((g) => (
              <button key={g.id} type="button" disabled={!canPay} onClick={() => onChoose('cimetiere', { ghost: g.id })} className={chip(params.ghost === g.id, !canPay)}>
                🪦 <Avatar index={g.avatar} scale={1} className="mx-1 inline align-middle" />{g.nickname}
              </button>
            ))}
          </div>
          {ghosts.length === 0 && <p className="text-xs text-ink/60">Aucun fantôme à interroger (les Saboteurs éliminés ne parlent pas).</p>}
          {!canPay && <p className="text-xs text-ink/60">Il te faut {COSTS.cimetiere} jeton pour interroger un fantôme.</p>}
          <p className="text-xs text-ink/60">Un fantôme peut mentir.</p>
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
          {!canPay && <p className="text-xs text-ink/60">Il te faut {COSTS.cimetiere} jeton pour choisir une tombe.</p>}
        </Options>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-sm text-mist-d">
        {player.is_bot ? `Nuit de ${player.nickname} (bot) : ` : ''}
        Choisis où passer la nuit. Ton choix est secret.
      </p>

      {closed.length > 0 && (
        <p className="border border-blood bg-blood/15 p-3 text-sm text-[#f0b4ae]">
          Fermé cette nuit : {closed.map((c) => LOCATIONS.find((l) => l.id === c)?.name ?? c).join(', ')}.
        </p>
      )}

      {allyInfo && allyInfo.length > 0 && (
        <div className="border border-blood bg-blood/15 p-3 text-sm text-[#f0b4ae]">
          <p className="text-xs uppercase tracking-wider text-[#f0b4ae]/70">Tes alliés cette nuit</p>
          <ul className="mt-1">
            {allyInfo.map((a) => (
              <li key={a.name}>
                💀 {a.name} : <strong>{a.location ? LOCATIONS.find((l) => l.id === a.location)?.name ?? a.location : 'pas encore décidé'}</strong>
                {a.location && !a.validated && <span className="text-[#f0b4ae]/70"> (hésite encore…)</span>}
                {a.haunted.length > 0 && <span className="text-[#f0b4ae]/80"> · hanté par {a.haunted.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <VillageMap
        marks={(allyInfo ?? []).filter((a) => a.location && a.name !== 'Toi').reduce<Record<string, { count: number; validated: boolean }>>((m, a) => {
          const k = a.location as string
          m[k] = { count: (m[k]?.count ?? 0) + 1, validated: (m[k]?.validated ?? true) && a.validated }
          return m
        }, {})}
        selected={loc}
        closed={closed}
        onSelect={(id) => onChoose(id, {})}
      />

      {selectedLoc ? (
        <LocationCard loc={selectedLoc} mode="night" validated={validated}>
          {options(selectedLoc.id) ?? <p className="font-sans text-sm text-ink/70">Aucune action ici : tu y passes simplement la nuit.</p>}
        </LocationCard>
      ) : (
        <p className="text-center text-sm text-mist-d">Touche un bâtiment pour y passer la nuit.</p>
      )}

      {validated ? (
        <div className="flex flex-col gap-2">
          <p className="border border-moss bg-moss/20 p-3 text-center text-sm text-[#bfe9dc]">
            <Px name="check" scale={2} className="mr-2 align-[-2px]" />Choix validé : {selectedLoc?.name}. En attente des autres joueurs…
          </p>
          <button type="button" onClick={back} disabled={busy} className="px-frame px-press px-4 py-3 font-pixel text-[13px] uppercase tracking-wide text-paper hover:!bg-night-3 disabled:opacity-40">
            ↩ Retour (modifier mon choix)
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={validate}
          disabled={!loc || busy || (loc === 'taverne' && rumOpen && params.action !== 'rumeur') || (params.action === 'don' && !params.target) || (params.rig === 'boost' && !params.target)}
          className="px-frame px-press !bg-paper px-4 py-3 font-pixel text-[13px] uppercase tracking-wide text-ink [box-shadow:inset_0_0_0_2px_#fff8e6,4px_4px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!loc ? 'Choisis un lieu pour valider' : (params.action === 'don' || params.rig === 'boost') && !params.target ? 'Choisis le joueur visé' : `Valider : ${selectedLoc?.name}`}
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
      <p className="text-xs text-ink/60">
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
      {active && savedTargets && <p className="text-xs font-semibold text-gold-d">Rumeur sélectionnée.</p>}
    </div>
  )
}
