import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import BackLink from '../components/BackLink'
import { Px } from '../components/Px'
import { Label, Screen, TitleBar } from '../components/ui'
import { getBalanceStats } from '../lib/api'
import type { BalanceStats } from '../lib/api'
import { SETTING_GROUPS } from '../data/settings'
import { getRole } from '../data/roles'

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : null)
const DEFS = SETTING_GROUPS.flatMap((g) => g.settings)

// Réglage modifié → « Libellé : valeur » lisible
function settingLabel(key: string, value: number) {
  const def = DEFS.find((d) => d.key === key)
  if (!def) return `${key} : ${value}`
  return `${def.label} : ${def.format ? def.format(value) : `${value}${def.unit ?? ''}`}`
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="px-frame p-2 text-center">
      <p className="font-display text-3xl font-bold text-paper">{value}</p>
      <p className="font-pixel text-[10px] uppercase tracking-wider text-sand">{label}</p>
      {sub && <p className="font-sans text-[10px] text-mist-d">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-frame p-4">
      <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wider text-paper">{title}</h2>
      {children}
    </section>
  )
}

// Barre bleue (Villageois) / rouge (Saboteurs) avec repère à 50 %
function WinBar({ v, s }: { v: number; s: number }) {
  const total = v + s
  const pv = total > 0 ? (100 * v) / total : 50
  return (
    <div className="relative">
      <div className="px-inset flex h-5 overflow-hidden bg-night">
        {total > 0 && <span className="block h-full bg-sea" style={{ width: `${pv}%` }} />}
        {total > 0 && <span className="block h-full flex-1 bg-blood" />}
      </div>
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-paper/70" title="Équilibre parfait : 50 %" />
    </div>
  )
}

export default function Balance() {
  const [stats, setStats] = useState<BalanceStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getBalanceStats().then(setStats).catch(() => setFailed(true))
  }, [])

  return (
    <Screen>
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Équilibrage" left={<BackLink to="/stats" />} />
      </div>
      <p className="font-sans text-sm text-mist-d">
        Toutes les parties terminées (hors mode debug), de tous les joueurs. Un jeu équilibré tourne autour de 50 % de victoires par camp.
      </p>

      {failed ? (
        <p className="px-frame p-4 font-sans text-mist-d">Données indisponibles pour le moment. Réessaie plus tard.</p>
      ) : !stats ? (
        <p className="font-pixel text-[11px] uppercase tracking-widest text-mist-d">Chargement…</p>
      ) : stats.games === 0 ? (
        <p className="px-frame-paper p-4 text-center font-sans">Aucune partie terminée pour l’instant. Joue une vraie partie (sans mode debug) pour voir les premiers chiffres.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Parties" value={stats.games} />
            <Tile label="Manches" value={stats.avg_rounds ?? '–'} sub="en moyenne" />
            <Tile label="Durée" value={stats.avg_minutes != null ? `${stats.avg_minutes}′` : '–'} sub="en moyenne" />
          </div>

          <Section title="Victoires par camp">
            <WinBar v={stats.villageois} s={stats.saboteurs} />
            <div className="mt-2 flex justify-between gap-2 font-sans text-xs">
              <span className="text-[#7fb3e0]">Villageois {stats.villageois} · {pct(stats.villageois, stats.games)} %</span>
              <span className="text-[#e8847c]">Saboteurs {stats.saboteurs} · {pct(stats.saboteurs, stats.games)} %</span>
            </div>
            <p className="mt-2 font-sans text-xs text-mist-d">
              Fin à l’aube (meurtres) : {stats.ended_nuit} · fin au vote : {stats.ended_vote}
            </p>
          </Section>

          <Section title="Par nombre de joueurs">
            <ul className="flex flex-col gap-3">
              {stats.by_players.map((b) => (
                <li key={b.players}>
                  <div className="mb-1 flex items-baseline justify-between font-sans text-sm">
                    <span className="shrink-0 whitespace-nowrap font-pixel text-[12px] uppercase tracking-wide text-paper">{b.players} joueurs</span>
                    <span className="text-right text-xs text-mist-d">
                      {b.games} partie{b.games > 1 ? 's' : ''} · {b.avg_rounds ?? '–'} manches{b.avg_minutes != null ? ` · ${b.avg_minutes} min` : ''}
                    </span>
                  </div>
                  <WinBar v={b.villageois} s={b.saboteurs} />
                  <p className="mt-1 font-sans text-[11px] text-mist-d">
                    Villageois {pct(b.villageois, b.games)} % · Saboteurs {pct(b.saboteurs, b.games)} %
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          {Object.keys(stats.solitaires).length > 0 && (
            <Section title="Solitaires">
              <ul>
                {Object.entries(stats.solitaires).map(([role, r]) => (
                  <li key={role} className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-night-3 py-1.5 font-sans text-sm last:border-0">
                    <span className="text-[#8fd6c2]">{getRole(role)?.name ?? role}</span>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-paper">{r.wins}/{r.games} · {pct(r.wins, r.games)} %</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Dernières parties">
            <ul className="flex flex-col gap-2">
              {stats.recent.map((g, i) => {
                const changed = Object.entries(g.settings ?? {})
                return (
                  <li key={`${g.ended_at}-${i}`} className="border-2 border-night-3 bg-night p-2 font-sans text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-mist-d">
                        {new Date(g.ended_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {g.players} j.
                        {g.saboteurs != null && ` · ${g.saboteurs} Sab.`}
                        {g.solitaires ? ` · ${g.solitaires} Sol.` : ''}
                      </span>
                      <span className={`flex items-center gap-1 font-pixel text-[11px] uppercase ${g.winner === 'saboteurs' ? 'text-[#e8847c]' : 'text-[#7fb3e0]'}`}>
                        {g.winner && <Px name={`team_${g.winner}_s`} scale={1} />}
                        {g.winner === 'saboteurs' ? 'Saboteurs' : g.winner === 'villageois' ? 'Villageois' : '–'}
                      </span>
                    </div>
                    <p className="text-[12px] text-mist">
                      {g.rounds} manche{g.rounds > 1 ? 's' : ''}
                      {g.minutes != null && ` · ${g.minutes} min`}
                      {g.ended_by && ` · fin ${g.ended_by === 'nuit' ? 'à l’aube' : 'au vote'}`}
                      {g.solo.length > 0 && ` · ${g.solo.map((s) => `${getRole(s.role)?.name.replace(/^L[’']|^Le /, '') ?? s.role} ${s.won ? '✓' : '✗'}`).join(', ')}`}
                    </p>
                    {changed.length > 0 && (
                      <p className="mt-1 text-[11px] text-gold">Réglages : {changed.map(([k, v]) => settingLabel(k, v)).join(' · ')}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </Section>
        </>
      )}

      <Label className="text-center">Données anonymes · aucun pseudo enregistré</Label>
    </Screen>
  )
}
