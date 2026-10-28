import type { ReactNode } from 'react'
import { AVATARS } from '../data/avatars'
import { LOCATIONS } from '../data/locations'
import type { DawnReport } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'

type Props = { report: DawnReport | null; players: Player[] }

export default function DayPanel({ report, players }: Props) {
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? `${AVATARS[p.avatar].emoji} ${p.nickname}` : 'Quelqu’un'
  }
  const locName = (id: string | null | undefined) => LOCATIONS.find((l) => l.id === id)?.name
  const loc = LOCATIONS.find((l) => l.id === report?.location)
  const present = (report?.present ?? [])
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  const r = report?.result ?? {}
  const events: ReactNode[] = []
  if (r.casino) {
    events.push(
      r.casino.won
        ? <>🎰 Tu as misé {r.casino.stake} et gagné : <strong className="text-amber-300">+{r.casino.stake} jeton{r.casino.stake > 1 ? 's' : ''}</strong>.</>
        : <>🎰 Tu as misé {r.casino.stake} et tout perdu.</>,
    )
  }
  if (r.don) events.push(<>🎁 Tu as offert {r.don.amount} jeton à {nameOf(r.don.target)} (en secret).</>)
  if (r.gifts_received) {
    events.push(
      <>🎁 Quelqu’un t’a offert <strong className="text-amber-300">{r.gifts_received} jeton{r.gifts_received > 1 ? 's' : ''}</strong> en secret.</>,
    )
  }
  if (r.rumeur) {
    events.push(
      <>
        🍺 Rumeur sur {r.rumeur.targets.map(nameOf).join(', ')} :{' '}
        <strong className={r.rumeur.has_saboteur ? 'text-red-400' : 'text-emerald-400'}>
          {r.rumeur.has_saboteur ? 'au moins un Saboteur se cache parmi eux' : 'aucun Saboteur parmi eux'}
        </strong>
        .
      </>,
    )
  }
  if (r.observation) {
    events.push(
      <>
        👁 {nameOf(r.observation.target)} a passé la nuit :{' '}
        <strong className="text-amber-300">{locName(r.observation.location) ?? 'nulle part'}</strong>.
      </>,
    )
  }
  if (r.sabotage) {
    events.push(
      r.sabotage.success ? (
        <>💀 Sabotage réussi : <strong className="text-amber-300">{locName(r.sabotage.location)}</strong> sera fermé cette nuit.</>
      ) : (
        <>💀 Sabotage raté : quelqu’un d’extérieur était à la Planque. Les jetons sont perdus.</>
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Rapport de l’aube</h2>
        {!report ? (
          <p className="mt-2 text-stone-400">Chargement…</p>
        ) : (
          <>
            <p className="mt-2">
              Cette nuit, tu étais : <strong className="text-amber-300">{loc?.name ?? 'nulle part'}</strong>.
            </p>
            {loc && !loc.visibleCrossing && (
              <p className="mt-1 text-stone-400">Ici, personne ne te voit et tu ne vois personne.</p>
            )}
            {loc?.visibleCrossing &&
              (present.length === 0 ? (
                <p className="mt-1 text-stone-400">Tu n’y as croisé personne.</p>
              ) : (
                <>
                  <p className="mt-1 text-stone-400">Tu y as croisé :</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {present.map((p) => (
                      <li key={p.id} className="rounded-full bg-stone-800 px-3 py-1">
                        {AVATARS[p.avatar].emoji} {p.nickname}
                      </li>
                    ))}
                  </ul>
                </>
              ))}
          </>
        )}
      </section>

      {events.length > 0 && (
        <section className={`${panelClass} p-4`}>
          <h2 className="text-lg font-bold text-amber-100">Ce que tu as appris</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {report && report.closed_next.length > 0 && (
        <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-4">
          <h2 className="text-lg font-bold text-red-300">Annonce du village</h2>
          <p className="mt-2 text-red-200">
            Un sabotage a eu lieu : {report.closed_next.map((c) => locName(c) ?? c).join(', ')} sera fermé cette nuit.
          </p>
        </section>
      )}

      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-amber-100">Le débat est ouvert</h2>
        <p className="mt-2 text-stone-400">
          Parlez, accusez, mentez : rien n’est prouvé. Le vote arrivera dans une prochaine étape ; pour l’instant, le jour se termine au bout du minuteur.
        </p>
      </section>
    </div>
  )
}
