import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Px } from './Px'
import { panelClass } from './ui'
import { jetons } from '../data/costs'
import { LOCATIONS } from '../data/locations'
import { TEAM_STYLE } from '../data/roles'
import type { TeamId } from '../data/roles'
import { getTrophy } from '../data/trophies'
import type { GameRecap as Recap, RecapPlayer } from '../lib/api'
import type { Player } from '../types'

// Récap de fin de partie, le même pour tous : exploits de chacun, distinctions, bilan par joueur, nuit par nuit.
// Tout y est révélé (la partie est finie), sauf les votes individuels qui restent secrets.

type Props = { recap: Recap; players: Player[]; meId?: string; debug?: boolean }

export default function GameRecap({ recap, players, meId, debug = false }: Props) {
  const player = (id: string | null | undefined) => players.find((p) => p.id === id)
  const Name = ({ id }: { id: string | null | undefined }) => {
    const p = player(id)
    return p ? <span className="whitespace-nowrap"><Avatar index={p.avatar} look={p.look} scale={1} className="mr-1 inline align-middle" />{p.nickname}</span> : <>?</>
  }
  const locName = (id: string | null) => LOCATIONS.find((l) => l.id === id)?.name ?? id ?? '?'

  const withFeats = recap.players
    .map((r) => ({ r, ids: [...new Set([...r.feats, ...r.new_trophies])] }))
    // Toujours ma ligne (même vide) en tête, puis les joueurs qui ont au moins un exploit
    .filter((x) => x.ids.length > 0 || x.r.player_id === meId)
    .sort((a, b) => Number(b.r.player_id === meId) - Number(a.r.player_id === meId))

  return (
    <div className="flex flex-col gap-3">
      {/* Exploits : trophées gagnés par chacun pendant cette partie */}
      <section className="px-frame-paper p-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider">
          <Px name="crown" scale={2} /> Exploits de la partie
        </h2>
        {debug && (
          <p className="mt-1 font-sans text-xs text-ink/70">
            Partie en mode debug : les exploits s’affichent, mais rien n’est enregistré dans les statistiques et aucun trophée n’est débloqué
            (ni « Bienvenue au village », ni les trophées cumulés sur plusieurs parties).
          </p>
        )}
        {withFeats.length === 0 ? (
          <p className="mt-2 font-sans text-sm text-ink/70">Aucun exploit cette fois-ci.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {withFeats.map(({ r, ids }) => (
              <li key={r.player_id}>
                <p className="font-sans text-sm font-semibold">
                  <Name id={r.player_id} />{r.player_id === meId && <span className="ml-1 text-ink/60">(toi)</span>}
                </p>
                {ids.length === 0 && <p className="mt-1 font-sans text-xs text-ink/60">Aucun exploit pour toi cette fois-ci.</p>}
                <ul className="mt-1 flex flex-col gap-1.5">
                  {ids.map((id) => {
                    const t = getTrophy(id)
                    const isNew = r.new_trophies.includes(id)
                    return (
                      <li key={id} className="flex items-center gap-3 border-2 border-ink/20 bg-paper-2 px-2 py-1.5">
                        <span className="text-xl leading-none">{t?.emoji ?? '🏆'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-pixel text-[11px] uppercase tracking-wide">{t?.name ?? id}</span>
                          {t && <span className="block font-sans text-xs text-ink/70">{t.description}</span>}
                        </span>
                        {isNew && <span className="shrink-0 border-2 border-ink bg-gold px-1.5 py-0.5 font-pixel text-[9px] uppercase tracking-wider">Nouveau</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <Link to="/stats" className="mt-3 block text-center font-pixel text-[11px] uppercase tracking-wide underline decoration-2 underline-offset-4">
          Voir mes statistiques ▸
        </Link>
      </section>

      <Awards recap={recap} Name={Name} />

      {/* Bilan par joueur */}
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Bilan de chacun</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {recap.players.map((r) => (
            <li key={r.player_id} className="border-2 border-night-3 bg-night p-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-sans text-sm ${player(r.player_id)?.is_alive ? 'text-paper' : 'text-mist-d'}`}><Name id={r.player_id} /></span>
                <span className="font-pixel text-[10px] uppercase tracking-wider text-mist-d">{fate(r)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{statChips(r)}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Nuit par nuit */}
      <section className={`${panelClass} p-4`}>
        <h2 className="text-lg font-bold text-paper">Nuit par nuit</h2>
        <p className="mt-1 text-xs text-mist-d">Qui est allé où, et ce qui s’y est passé. Les votes individuels restent secrets.</p>
        <div className="mt-2 flex flex-col gap-2">
          {recap.nights.map((n) => {
            const byLoc = LOCATIONS.map((l) => ({ l, who: n.moves.filter((m) => m.location === l.id) })).filter((x) => x.who.length > 0)
            const vote = recap.votes.find((v) => v.round === n.round)
            return (
              <details key={n.round} className="group border-2 border-night-3 bg-night" open={recap.nights.length <= 2}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-pixel text-[11px] uppercase tracking-wider text-paper [&::-webkit-details-marker]:hidden">
                  <span><Px name="moon" scale={1} className="mr-2 align-middle" />Manche {n.round}{n.deaths.length > 0 && <span className="ml-2 text-[#f0b4ae]">· {n.deaths.length} mort{n.deaths.length > 1 ? 's' : ''}</span>}</span>
                  <span className="text-gold transition-transform group-open:rotate-90">▸</span>
                </summary>
                <div className="flex flex-col gap-1.5 border-t-2 border-night-3 px-3 py-2 font-sans text-sm text-mist">
                  {byLoc.map(({ l, who }) => (
                    <p key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <l.icon size={14} className="shrink-0 text-gold" />
                      <span className="text-mist-d">{l.name} :</span>
                      {who.map((m) => {
                        const dead = n.deaths.some((d) => d.player_id === m.player_id)
                        return <span key={m.player_id} className={dead ? 'text-[#f0b4ae]' : 'text-paper'}>{dead && '💀 '}<Name id={m.player_id} /></span>
                      })}
                    </p>
                  ))}
                  {n.sabotages.map((s) => (
                    <p key={`s${s.player_id}`}>💀 <Name id={s.player_id} /> {s.success ? 'a saboté' : 'a tenté de saboter'} : <strong className="text-paper">{locName(s.location)}</strong>{s.success ? '' : ' (raté)'}.</p>
                  ))}
                  {n.rigs.map((g) => (
                    <p key={`m${g.player_id}`}>🏛 <Name id={g.player_id} /> {g.kind === 'boost' ? <>a truqué le vote contre <Name id={g.target_id} />.</> : g.kind === 'shield' ? 'a fait annuler les voix reçues.' : 'a truqué une Mairie sabotée et s’est pris une voix.'}</p>
                  ))}
                  {vote && (
                    <p className="mt-1 border-t border-night-3 pt-1.5">
                      🗳 Vote : {vote.eliminated_id ? <><Name id={vote.eliminated_id} /> éliminé{vote.eliminated_team && <> ({teamLabel(vote.eliminated_team)})</>}</> : 'personne n’est éliminé'}
                      {vote.runoffs > 0 && <span className="text-mist-d"> · {vote.runoffs} revote{vote.runoffs > 1 ? 's' : ''}{vote.drawn ? ', tirage au sort' : ''}</span>}.
                    </p>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const teamLabel = (t: string) => {
  const s = TEAM_STYLE[t as TeamId]
  return s ? <span className={s.text}>{t === 'solitaires' ? 'Solitaire' : t === 'saboteurs' ? 'Saboteur' : 'Villageois'}</span> : t
}

function fate(r: RecapPlayer) {
  if (r.killed_round) return `Tué la nuit ${r.killed_round}`
  if (r.eliminated_round) return `Éliminé au vote ${r.eliminated_round}`
  return 'En vie à la fin'
}

const chip = (key: string, content: ReactNode) => (
  <span key={key} className="border border-night-3 bg-night-2 px-1.5 py-0.5 font-sans text-xs text-mist">{content}</span>
)

function statChips(r: RecapPlayer): ReactNode[] {
  const out: ReactNode[] = [chip('tok', <>🪙 {jetons(r.tokens)} à la fin</>)]
  if (r.kills) out.push(chip('k', <>🔪 {r.kills} meurtre{r.kills > 1 ? 's' : ''}</>))
  if (r.casino_bets) out.push(chip('c', <>🎰 {r.casino_bets} mise{r.casino_bets > 1 ? 's' : ''}, {r.casino_net > 0 ? '+' : ''}{r.casino_net}</>))
  if (r.gifts_given) out.push(chip('g', <>🎁 {r.gifts_given} offert{r.gifts_given > 1 ? 's' : ''}</>))
  if (r.gifts_received) out.push(chip('gr', <>🎁 {jetons(r.gifts_received)} reçu{r.gifts_received > 1 ? 's' : ''}</>))
  if (r.mairie_ok || r.mairie_fail) out.push(chip('m', <>🏛 {r.mairie_ok} trucage{r.mairie_ok > 1 ? 's' : ''}{r.mairie_fail ? `, ${r.mairie_fail} raté${r.mairie_fail > 1 ? 's' : ''}` : ''}</>))
  if (r.sabotages) out.push(chip('s', <>💀 {r.sabotages} sabotage{r.sabotages > 1 ? 's' : ''}</>))
  return out
}

// Distinctions : le meilleur de la partie dans chaque catégorie (rien si personne ne s'y est essayé)
function Awards({ recap, Name }: { recap: Recap; Name: (p: { id: string }) => ReactNode }) {
  const best = (f: (r: RecapPlayer) => number, min = 1) => {
    const top = Math.max(...recap.players.map(f))
    if (!(top >= min)) return null
    return { ids: recap.players.filter((r) => f(r) === top).map((r) => r.player_id), value: top }
  }
  const worst = recap.players.reduce((m, r) => Math.min(m, r.casino_net), 0)
  const awards = [
    { icon: '🪙', title: 'Le plus riche', b: best((r) => r.tokens), unit: (v: number) => jetons(v) },
    { icon: '🔪', title: 'Le plus redoutable', b: best((r) => r.kills), unit: (v: number) => `${v} meurtre${v > 1 ? 's' : ''}` },
    { icon: '🎰', title: 'Roi du Casino', b: best((r) => r.casino_net), unit: (v: number) => `+${jetons(v)}` },
    { icon: '💸', title: 'Plumé au Casino', b: worst < 0 ? best((r) => -r.casino_net) : null, unit: (v: number) => `−${jetons(v)}` },
    { icon: '🎁', title: 'Le plus généreux', b: best((r) => r.gifts_given), unit: (v: number) => `${v} cadeau${v > 1 ? 'x' : ''}` },
    { icon: '🏛', title: 'Magouilleur', b: best((r) => r.mairie_ok), unit: (v: number) => `${v} trucage${v > 1 ? 's' : ''}` },
    { icon: '💀', title: 'Saboteur en chef', b: best((r) => r.sabotages), unit: (v: number) => `${v} sabotage${v > 1 ? 's' : ''}` },
  ].filter((a) => a.b)
  if (awards.length === 0) return null
  return (
    <section className={`${panelClass} p-4`}>
      <h2 className="text-lg font-bold text-paper">Distinctions</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {awards.map((a) => (
          <li key={a.title} className="flex flex-col gap-0.5 border-2 border-night-3 bg-night p-2">
            <span className="font-pixel text-[10px] uppercase tracking-wider text-gold">{a.icon} {a.title}</span>
            <span className="font-sans text-sm text-paper">{a.b!.ids.map((id, i) => <span key={id}>{i > 0 && ', '}<Name id={id} /></span>)}</span>
            <span className="font-sans text-xs text-mist-d">{a.unit(a.b!.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
