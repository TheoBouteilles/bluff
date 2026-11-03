import { AVATARS } from '../data/avatars'
import { LOCATIONS } from '../data/locations'
import type { GhostReport } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

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
}

const chip = (active: boolean) =>
  `flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
    active
      ? 'border-amber-500 bg-amber-900/20 text-amber-100'
      : 'border-amber-800/40 bg-stone-900/80 hover:border-amber-600/60'
  }`

export default function GhostPanel({ mode, round, self, report, players, onWatch, onHint, tombCount, onTomb }: Props) {
  const find = (id: string) => players.find((p) => p.id === id)
  const label = (id: string) => {
    const p = find(id)
    return p ? `${AVATARS[p.avatar].emoji} ${p.nickname}` : 'Quelqu’un'
  }
  const locName = (id: string | null) => LOCATIONS.find((l) => l.id === id)?.name ?? 'nulle part'
  const alive = players.filter((p) => p.is_alive)
  const current = report?.watches.find((w) => w.round === round)?.target_id
  const past = (report?.watches ?? []).filter((w) => w.location !== null || w.round < round)
  const suspectOptions = players.filter((p) => p.id !== self?.id)

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">👻 Tu es un fantôme</h2>
        <p className="mt-2 text-stone-400">
          Tu ne joues ni ne votes plus, et il ne faut plus parler à la table. Mais tu peux observer les vivants
          et laisser un indice.
        </p>
      </section>

      {mode === 'night' && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-amber-100">Qui observer cette nuit ?</h2>
          <p className="mt-1 text-sm text-stone-400">À l’aube, tu sauras où il est allé. C’est gratuit.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {alive.map((p) => (
              <button key={p.id} type="button" onClick={() => onWatch(p.id)} className={chip(current === p.id)}>
                <span className="text-xl">{AVATARS[p.avatar].emoji}</span>
                <span className="font-semibold">{p.nickname}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-sm text-stone-400">
            {current ? 'Choix enregistré. Tu peux encore le changer.' : 'Sans choix, tu n’observes personne.'}
          </p>
        </section>
      )}

      {past.length > 0 && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-amber-100">Tes observations</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {past.map((w) => (
              <li key={w.round}>
                Nuit {w.round} : <strong>{label(w.target_id)}</strong> était{' '}
                <strong className="text-amber-300">{w.location === null ? 'introuvable' : locName(w.location)}</strong>.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Ta tombe</h2>
        <p className="mt-1 text-sm text-stone-400">
          Choisis en secret ta tombe au Cimetière. Un vivant qui choisit la même reçoit ton suspect. Le choix est définitif ; sans choix avant la prochaine nuit, elle est tirée au hasard.
        </p>
        {report?.tomb ? (
          <p className="mt-3 text-center font-semibold text-amber-300">🪦 Ta tombe : n°{report.tomb} (définitive)</p>
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

      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Ton suspect</h2>
        <p className="mt-1 text-sm text-stone-400">
          Désigne le méchant probable. Un vivant qui trouvera ta tombe au Cimetière recevra ce nom. Tu peux le changer
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
              <span className="text-xl">{AVATARS[p.avatar].emoji}</span>
              <span className={`font-semibold ${p.is_alive ? '' : 'line-through opacity-60'}`}>{p.nickname}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-sm text-stone-400">
          {report?.suspect ? `Suspect actuel : ${label(report.suspect)} (touche-le pour l’effacer).` : 'Aucun suspect désigné.'}
        </p>
      </section>
    </div>
  )
}
