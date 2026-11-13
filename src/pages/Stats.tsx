import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import { Px } from '../components/Px'
import { Label, Screen, TitleBar, styles } from '../components/ui'
import { getMyStats } from '../lib/api'
import type { MyStats } from '../lib/api'
import { TROPHIES } from '../data/trophies'
import { LOCATIONS } from '../data/locations'
import { TEAM_STYLE, getRole } from '../data/roles'
import type { TeamId } from '../data/roles'

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)} %` : '–')

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="px-frame p-2 text-center">
      <p className="font-display text-3xl font-bold text-paper">{value}</p>
      <p className="font-pixel text-[10px] uppercase tracking-wider text-sand">{label}</p>
      {sub && <p className="font-sans text-[10px] text-mist-d">{sub}</p>}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <section className="px-frame p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-paper">
        {icon && <Px name={icon} scale={2} />} {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-night-3 py-1.5 font-sans text-sm last:border-0">
      <span className="text-mist">{label}</span>
      <span className="shrink-0 font-semibold text-paper">{value}</span>
    </li>
  )
}

export default function Stats() {
  const [stats, setStats] = useState<MyStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getMyStats().then(setStats).catch(() => setFailed(true))
  }, [])

  const unlocked = new Map((stats?.trophies ?? []).map((t) => [t.id, t.unlocked_at]))
  const locMax = Math.max(1, ...Object.values(stats?.locations ?? {}))

  return (
    <Screen>
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Statistiques" left={<BackLink to="/" />} right={<Px name="crown" scale={2} />} />
      </div>

      {failed ? (
        <p className="px-frame p-4 font-sans text-mist-d">Statistiques indisponibles pour le moment. Réessaie plus tard.</p>
      ) : !stats ? (
        <p className="font-pixel text-[11px] uppercase tracking-widest text-mist-d">Chargement…</p>
      ) : (
        <>
          {stats.games === 0 && (
            <div className="px-frame-paper p-4 text-center">
              <p className="font-sans">Aucune partie terminée pour l’instant.</p>
              <p className="mt-1 font-sans text-xs opacity-70">Les parties en mode debug ne sont pas comptées.</p>
              <Link to="/creer" className={`${styles.secondary} mt-3 w-full`}>Créer une partie</Link>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Tile label="Parties" value={stats.games} />
            <Tile label="Victoires" value={stats.wins} />
            <Tile label="Taux" value={pct(stats.wins, stats.games)} />
            <Tile label="Série" value={stats.current_streak} sub="en cours" />
            <Tile label="Record" value={stats.best_streak} sub="d’affilée" />
            <Tile label="Trophées" value={`${unlocked.size}/${TROPHIES.length}`} />
          </div>

          <Section title="Par camp">
            <ul>
              {(['villageois', 'saboteurs'] as const).map((t) => {
                const g = stats[`${t}_games`]
                const w = stats[`${t}_wins`]
                return (
                  <Row key={t}
                    label={<span className={`inline-flex items-center gap-2 ${TEAM_STYLE[t].text}`}><Px name={`team_${t}_s`} scale={2} /> {TEAM_STYLE[t].label}</span>}
                    value={`${w} / ${g} (${pct(w, g)})`} />
                )
              })}
            </ul>
          </Section>

          <Section title="Survie et vote" icon="skull">
            <ul>
              <Row label="Nuits survécues" value={stats.nights_survived} />
              <Row label="En vie à la fin" value={stats.alive_at_end} />
              <Row label="Tué la nuit" value={stats.killed} />
              <Row label="Éliminé au vote" value={stats.eliminated} />
              <Row label="Éliminé alors qu’innocent" value={stats.wrongly_eliminated} />
              <Row label="Flair (votes contre un Saboteur)" value={`${stats.votes_on_saboteur}/${stats.votes_cast} · ${pct(stats.votes_on_saboteur, stats.votes_cast)}`} />
            </ul>
          </Section>

          <Section title="Lieux visités" icon="moon">
            {Object.keys(stats.locations).length === 0 ? (
              <p className="font-sans text-sm text-mist-d">Aucune nuit jouée.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {LOCATIONS.filter((l) => stats.locations[l.id])
                  .sort((a, b) => stats.locations[b.id] - stats.locations[a.id])
                  .map((l) => {
                    const n = stats.locations[l.id]
                    return (
                      <li key={l.id} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate font-pixel text-[11px] uppercase tracking-wide text-mist">{l.name}</span>
                        <span className="px-inset h-4 flex-1 bg-night">
                          <span className="block h-full bg-gold" style={{ width: `${(100 * n) / locMax}%` }} />
                        </span>
                        <span className="w-6 text-right font-display text-lg font-bold text-paper">{n}</span>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Section>

          <Section title="Jetons et coups tordus" icon="coin">
            <ul>
              <Row label="Mises au Casino (gagnées)" value={`${stats.casino_bets} (${stats.casino_wins})`} />
              <Row label="Bilan du Casino" value={`${stats.casino_net > 0 ? '+' : ''}${stats.casino_net} jetons`} />
              <Row label="Plus gros gain au Casino" value={`${stats.casino_best_win} jetons`} />
              <Row label="Cadeaux offerts" value={stats.gifts_given} />
              <Row label="Jetons reçus en cadeau" value={stats.gifts_received} />
              <Row label="Trucages réussis / ratés" value={`${stats.mairie_success} / ${stats.mairie_fail}`} />
              <Row label="Meurtres (en Saboteur)" value={stats.kills} />
              <Row label="Lieux fermés depuis la Planque" value={stats.sabotages_ok} />
              <Row label={<span className="inline-flex items-center gap-2"><Px name="ghost" scale={1} /> Suspect juste en fantôme</span>} value={`${stats.ghost_right} / ${stats.ghost_games}`} />
              <Row label="Indices utiles au Cimetière" value={stats.cemetery_good_hints} />
            </ul>
          </Section>

          <Section title="Trophées" icon="crown">
            <ul className="grid grid-cols-2 gap-3">
              {TROPHIES.map((t) => {
                const at = unlocked.get(t.id)
                return (
                  <li key={t.id} className={`${at ? 'px-frame-paper' : 'px-frame opacity-60'} p-3`}>
                    <div className="flex h-8 items-center">
                      {at ? <span className="text-2xl leading-none">{t.emoji}</span> : <Px name="lock" scale={3} />}
                    </div>
                    <p className={`mt-1 font-pixel text-[11px] uppercase leading-tight tracking-wide ${at ? 'text-ink' : 'text-paper'}`}>{t.name}</p>
                    <p className={`mt-1 font-sans text-[11px] leading-snug ${at ? 'text-ink/70' : 'text-mist-d'}`}>{t.description}</p>
                    {at && <p className="mt-1 font-pixel text-[10px] text-gold-d">{new Date(at).toLocaleDateString('fr-FR')}</p>}
                  </li>
                )
              })}
            </ul>
          </Section>

          {stats.recent.length > 0 && (
            <Section title="Dernières parties">
              <ul>
                {stats.recent.map((g) => {
                  const team = TEAM_STYLE[g.team as TeamId]
                  return (
                    <li key={g.ended_at} className="flex items-center justify-between gap-2 border-b-2 border-dashed border-night-3 py-1.5 font-sans text-sm last:border-0">
                      <span className="text-mist-d">
                        {new Date(g.ended_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {g.rounds} manche{g.rounds > 1 ? 's' : ''}
                      </span>
                      <span className={team?.text ?? ''}>{getRole(g.role_id)?.name ?? g.role_id}</span>
                      <span className={`font-pixel text-[11px] uppercase ${g.won ? 'text-gold' : 'text-[#e8847c]'}`}>
                        {g.won ? 'Victoire' : 'Défaite'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          <Label className="text-center">Stats liées à cet appareil · comptes bientôt</Label>
        </>
      )}
    </Screen>
  )
}
