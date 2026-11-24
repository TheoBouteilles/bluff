import type { ReactNode } from 'react'
import { COSTS, jetons } from '../data/costs'
import { Avatar, Px } from './Px'
import { LOCATIONS } from '../data/locations'
import type { DawnReport } from '../lib/api'
import type { Player } from '../types'
import { panelClass } from './ui'
import VillageMap from './VillageMap'

type Props = { report: DawnReport | null; players: Player[] }

export default function DayPanel({ report, players }: Props) {
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id)
    return p ? <><Avatar index={p.avatar} look={p.look} scale={1} className="mr-1 inline align-middle" />{p.nickname}</> : 'Quelqu’un'
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
        ? <>🎰 Tu as misé {jetons(r.casino.stake)} et gagné : <strong className="text-gold">+{jetons(r.casino.stake)}</strong>.</>
        : <>🎰 Tu as misé {jetons(r.casino.stake)} et tout perdu.</>,
    )
  }
  if (r.don) {
    events.push(
      r.don.ok === false ? (
        <>🎁 Cadeau raté : {nameOf(r.don.target)} n’était pas à la Taverne. Ton jeton est conservé.</>
      ) : (
        <>🎁 Tu as offert {jetons(r.don.amount)} à {nameOf(r.don.target)} (en secret).</>
      ),
    )
  }
  if (r.gifts_received) {
    events.push(
      <>🎁 Quelqu’un t’a offert <strong className="text-gold">{jetons(r.gifts_received)}</strong> en secret.</>,
    )
  }
  if (r.rumeur) {
    events.push(
      <>
        🍺 Rumeur sur {r.rumeur.targets.map((id, i) => <span key={id}>{i > 0 ? ', ' : ''}{nameOf(id)}</span>)} :{' '}
        <strong className={r.rumeur.has_saboteur ? 'text-[#e8847c]' : 'text-[#8fd6c2]'}>
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
        <strong className="text-gold">{locName(r.observation.location) ?? 'nulle part'}</strong>.
      </>,
    )
  }
  if (r.mairie) {
    const m = r.mairie
    if (m.success) {
      events.push(
        m.rig === 'boost' ? (
          <>🏛 Trucage réussi : <strong className="text-gold">+{COSTS.mairieBoost} voix contre {m.target ? nameOf(m.target) : 'ton choix'}</strong> au premier dépouillement.</>
        ) : (
          <>🏛 Trucage réussi : <strong className="text-gold">les voix contre toi seront annulées</strong> au premier dépouillement.</>
        ),
      )
    } else if (m.attempted) {
      events.push(<>🏛 Trucage raté : vous étiez plusieurs à la Mairie. Les jetons sont perdus.</>)
    } else {
      events.push(<>🏛 Quelqu’un a tenté de truquer le vote à la Mairie, mais vous étiez plusieurs : le trucage a échoué.</>)
    }
  }
  if (r.cimetiere) {
    const c = r.cimetiere
    const where = c.ghost ? <>Tombe de {nameOf(c.ghost)}</> : `Tombe ${c.tomb}`
    if (!c.ok) {
      events.push(<>🪦 Tu n’avais plus de quoi payer : la tombe est restée silencieuse.</>)
    } else if (c.spirits.length === 0) {
      events.push(<>🪦 {where} : personne ne répond. Aucun fantôme n’a choisi cette tombe.</>)
    } else {
      for (const sp of c.spirits) {
        events.push(
          sp.suspect_id ? (
            <>👻 {where} : l’esprit de <strong className="text-gold">{nameOf(sp.ghost_id)}</strong> te murmure que <strong className="text-[#e8847c]">{nameOf(sp.suspect_id)}</strong> est suspect. (Un fantôme peut mentir.)</>
          ) : (
            <>👻 {where} : l’esprit de <strong className="text-gold">{nameOf(sp.ghost_id)}</strong> n’a aucun soupçon à te confier.</>
          ),
        )
      }
    }
  }
  if (r.sabotage) {
    events.push(
      r.sabotage.success ? (
        <>💀 Sabotage réussi : <strong className="text-gold">{locName(r.sabotage.location)}</strong> a été saboté cette nuit, en secret.{r.sabotage.shared ? ' (Un allié visait déjà ce lieu : rien payé.)' : ''}</>
      ) : (
        <>💀 Sabotage raté : un non-Saboteur est resté en vie à la Planque.{r.sabotage.shared ? '' : ' Les jetons sont perdus.'}</>
      ),
    )
  }
  if (r.casino_steal) {
    events.push(<>🎰 Casino saboté : tu empoches la moitié des mises jouées, <strong className="text-gold">+{jetons(r.casino_steal)}</strong>.</>)
  }

  return (
    <div className="flex flex-col gap-3">
      {report && report.deaths.length > 0 && (
        <section className="border border-blood bg-blood/15 p-4">
          <h2 className="text-lg font-bold text-[#f0b4ae]">Un cri a déchiré la nuit…</h2>
          <ul className="mt-2 flex flex-col gap-1 text-[#f0b4ae]">
            {report.deaths.map((d) => (
              <li key={d.player_id}>
                💀 <strong>{nameOf(d.player_id)}</strong> a été retrouvé mort
                {d.location ? ` (${locName(d.location) ?? d.location})` : ''}.
              </li>
            ))}
          </ul>
        </section>
      )}
      {report && report.deaths.length === 0 && (
        // Aussi visible que l'alerte rouge : une nuit sans mort est une information en soi
        <section className="flex items-center gap-3 border-2 border-[#5fb3a0] bg-moss/60 p-4">
          <Px name="sun" scale={2} className="shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-[#c8f0e4]">Nuit calme : personne n’est mort.</h2>
            <p className="mt-0.5 text-sm text-paper/85">Tout le village s’est réveillé. Les Saboteurs n’ont fait aucune victime.</p>
          </div>
        </section>
      )}
      <VillageMap mode="day" readonly selected={report?.location ?? undefined} />
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Rapport de l’aube</h2>
        {!report ? (
          <p className="mt-2 text-mist-d">Chargement…</p>
        ) : report.killed ? (
          <p className="mt-2 text-[#f0b4ae]">
            💀 Tu as été tué pendant la nuit. Tu es désormais un fantôme : tu ne parles plus à la table et tu ne votes plus.
          </p>
        ) : (
          <>
            <p className="mt-2">
              Cette nuit, tu étais : <strong className="text-gold">{loc?.name ?? 'nulle part'}</strong>.
            </p>
            {report.cry && (
              <p className="mt-1 text-[#f0b4ae]">
                😱 Tu as entendu un cri : quelqu’un a été tué près de toi. Tu ne sais pas qui était là.
              </p>
            )}
            {loc && !loc.visibleCrossing && (
              <p className="mt-1 text-mist-d">Ici, personne ne te voit et tu ne vois personne.</p>
            )}
            {loc?.visibleCrossing && !report.cry &&
              (present.length === 0 ? (
                <p className="mt-1 text-mist-d">Tu n’y as croisé personne.</p>
              ) : (
                <>
                  <p className="mt-1 text-mist-d">Tu y as croisé :</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {present.map((p) => (
                      <li key={p.id} className="bg-night px-3 py-1">
                        <Avatar index={p.avatar} look={p.look} scale={1} className="mr-1 inline align-middle" />{p.nickname}
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
          <h2 className="text-lg font-bold text-paper">Ce que tu as appris</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {report && report.closed_next.length > 0 && (
        <section className="border border-blood bg-blood/15 p-4">
          <h2 className="text-lg font-bold text-[#f0b4ae]">Annonce du village</h2>
          <p className="mt-2 text-[#f0b4ae]">
            Un sabotage a eu lieu : {report.closed_next.map((c) => locName(c) ?? c).join(', ')} sera fermé cette nuit.
          </p>
        </section>
      )}

      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Le débat est ouvert</h2>
        <p className="mt-2 text-mist-d">
          Parlez, accusez, mentez : rien n’est prouvé. L’hôte ouvrira le vote quand la discussion sera terminée.
        </p>
      </section>
    </div>
  )
}
