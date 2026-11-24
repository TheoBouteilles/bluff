import { useState } from 'react'
import { Avatar } from './Px'
import { LOCATIONS } from '../data/locations'
import type { GhostReport } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'
import VillageMap from './VillageMap'

type Props = {
  mode: 'night' | 'info'
  round: number
  self?: Player
  report: GhostReport | null
  players: Player[] // tous les joueurs
  onWatch: (targetId: string) => void
  onHint: (suspectId: string | null) => void
  tombCount: number
  onTomb: (tomb: number) => void
  namedCemetery: boolean
  isSaboteur: boolean
  hauntPct: number | null // bonus par fantôme ; null = option désactivée
  onHaunt: (location: string | null) => void // lieu hanté cette nuit (null = aucun)
}

const chip = (active: boolean) =>
  `flex items-center gap-2 border-2 px-3 py-2 text-left text-sm transition ${
    active
      ? 'border-ink bg-paper text-ink'
      : 'border-night-3 bg-night-2 hover:border-gold'
  }`

export default function GhostPanel({ mode, round, self, report, players, onWatch, onHint, tombCount, onTomb, namedCemetery, isSaboteur, hauntPct, onHaunt }: Props) {
  const find = (id: string) => players.find((p) => p.id === id)
  const label = (id: string) => {
    const p = find(id)
    return p ? <><Avatar index={p.avatar} look={p.look} scale={1} className="mr-1 inline align-middle" />{p.nickname}</> : 'Quelqu’un'
  }
  const locName = (id: string | null) => LOCATIONS.find((l) => l.id === id)?.name ?? 'nulle part'
  const alive = players.filter((p) => p.is_alive)
  const current = report?.watches.find((w) => w.round === round)?.target_id
  const past = (report?.watches ?? []).filter((w) => w.location !== null || w.round < round)
  const suspectOptions = players.filter((p) => p.id !== self?.id)

  const haunter = isSaboteur && hauntPct !== null // fantôme Saboteur : il aide ses alliés au lieu d'espionner
  const choosing = mode === 'night' && haunter // la carte sert à choisir le lieu hanté
  const [mapHint, setMapHint] = useState<string | null>(null)
  const pickHaunt = (loc: string) => {
    if (loc === 'maison') {
      setMapHint('Personne ne meurt chez soi : impossible d’y hanter.')
      return
    }
    setMapHint(null)
    onHaunt(report?.haunt === loc ? null : loc)
  }

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">👻 Tu es un fantôme</h2>
        <p className="mt-2 text-mist-d">
          {haunter
            ? 'Tu ne votes plus et tu ne dois plus parler à la table. Mais tu restes un Saboteur : chaque nuit, tu peux hanter un lieu pour y augmenter les chances de meurtre de tes alliés.'
            : 'Tu ne votes plus et tu ne dois plus parler à la table. Mais chaque nuit, tu peux observer un vivant et désigner ton suspect.'}
        </p>
      </section>

      {mode === 'night' && !haunter && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-paper">Qui observer cette nuit ?</h2>
          <p className="mt-1 text-sm text-mist-d">À l’aube, tu sauras où il est allé. C’est gratuit.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {alive.map((p) => (
              <button key={p.id} type="button" onClick={() => onWatch(p.id)} className={chip(current === p.id)}>
                <Avatar index={p.avatar} look={p.look} scale={2} />
                <span className="font-semibold">{p.nickname}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-sm text-mist-d">
            {current ? 'Choix enregistré. Tu peux encore le changer.' : 'Sans choix, tu n’observes personne.'}
          </p>
        </section>
      )}

      {/* Les morts gardent la carte du village sous les yeux (sans information) ; le fantôme Saboteur y choisit son lieu */}
      <section className="flex flex-col gap-2">
        {choosing && (
          <div className={`${panelClass} p-4`}>
            <h2 className="text-lg font-bold text-[#f0b4ae]">💀 Hanter un lieu</h2>
            <p className="mt-1 text-sm text-mist-d">
              Devine où ira un Saboteur vivant cette nuit : si l’un d’eux y passe, sa chance de meurtre gagne {hauntPct} points
              (cumulable entre fantômes). Tu ne vois plus où vont tes alliés.
            </p>
          </div>
        )}
        <VillageMap
          mode={mode === 'night' ? 'night' : 'day'}
          readonly={!choosing}
          selected={choosing ? report?.haunt ?? undefined : undefined}
          onSelect={choosing ? pickHaunt : undefined}
          label="Carte du village : choisis le lieu à hanter"
        />
        {choosing && (
          <p className="text-center text-sm text-mist-d">
            {mapHint ?? (report?.haunt ? <>Tu hantes : <strong className="text-gold">{locName(report.haunt)}</strong> (touche-le pour annuler).</> : 'Touche un lieu pour le hanter. Sans choix, tu ne hantes rien.')}
          </p>
        )}
      </section>

      {past.length > 0 && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-paper">Tes observations</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {past.map((w) => (
              <li key={w.round}>
                Nuit {w.round} : <strong>{label(w.target_id)}</strong> était{' '}
                <strong className="text-gold">{w.location === null ? 'introuvable' : locName(w.location)}</strong>.
              </li>
            ))}
          </ul>
        </section>
      )}

      {!namedCemetery && (
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Ta tombe</h2>
        <p className="mt-1 text-sm text-mist-d">
          Choisis en secret ta tombe au Cimetière. Un vivant qui choisit la même reçoit ton suspect. Le choix est définitif ; sans choix avant la prochaine nuit, elle est tirée au hasard.
        </p>
        {report?.tomb ? (
          <p className="mt-3 text-center font-semibold text-gold">🪦 Ta tombe : n°{report.tomb} (définitive)</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: tombCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => onTomb(n)} className={chip(false)}>
                🪦 Tombe {n}
              </button>
            ))}
          </div>
        )}
      </section>
      )}

      {!(namedCemetery && isSaboteur) && (
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Ton suspect</h2>
        <p className="mt-1 text-sm text-mist-d">
          Désigne le joueur que tu soupçonnes. {namedCemetery ? 'Un vivant qui t’interroge au Cimetière recevra ce nom.' : 'Un vivant qui trouvera ta tombe au Cimetière recevra ce nom.'} Tu peux le changer
          à tout moment, ou mentir.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {suspectOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onHint(report?.suspect === p.id ? null : p.id)}
              className={chip(report?.suspect === p.id)}
            >
              <Avatar index={p.avatar} look={p.look} scale={2} />
              <span className={`font-semibold ${p.is_alive ? '' : 'line-through opacity-60'}`}>{p.nickname}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-sm text-mist-d">
          {report?.suspect ? <>Suspect actuel : {label(report.suspect)} (touche-le pour l’effacer).</> : 'Aucun suspect désigné.'}
        </p>
      </section>
      )}
    </div>
  )
}
