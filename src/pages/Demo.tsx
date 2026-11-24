import { useState } from 'react'
import DayPanel from '../components/DayPannel'
import EndPanel from '../components/EndPannel'
import GhostPanel from '../components/GhostPannel'
import HoldToReveal from '../components/HoldToReveal'
import NightPanel from '../components/NightPannel'
import { Avatar, Px } from '../components/Px'
import ResultPanel from '../components/ResultPannel'
import RoleCard from '../components/RoleCard'
import { Button, Note, Screen, Tabs, TitleBar, TokenBadge } from '../components/ui'
import VotePanel from '../components/VotePannel'
import { AVATARS } from '../data/avatars'
import { SIMPLE_ROLES, SOLO_ROLES } from '../data/roles'
import SolitairePanel from '../components/SolitairePanel'
import SettingsPanel from '../components/SettingsPanel'
import type { Player } from '../types'
import type { GameRecap } from '../lib/api'

/*
 * Vitrine de l'interface avec des données factices (dev uniquement, route /demo).
 * Sert à vérifier le rendu des composants sans partie en cours ni Supabase.
 */
const P = (i: number, n: string, alive = true, host = false): Player => ({
  id: `p${i}`, room_id: 'r', user_id: null, nickname: n, avatar: i, is_host: host, is_bot: false, is_alive: alive, joined_at: '',
})
const players = [P(0, 'Marcel', true, true), P(1, 'Jeanne'), P(2, 'Ahmed'), P(3, 'Lucie', false), P(4, 'Théo'), P(5, 'Nina'), P(6, 'Paul')]
const me = players[4]
const R = (i: number, o: Partial<GameRecap['players'][number]> = {}): GameRecap['players'][number] => ({
  player_id: `p${i}`, tokens: 2, killed_round: null, eliminated_round: null, nights: 3, kills: 0, casino_bets: 0, casino_net: 0,
  gifts_given: 0, gifts_received: 0, mairie_ok: 0, mairie_fail: 0, sabotages: 0, feats: [], new_trophies: [], ...o,
})
const demoRecap: GameRecap = {
  players: [
    R(0, { tokens: 4, kills: 2, sabotages: 1 }), R(1, { casino_bets: 2, casino_net: 3, feats: ['jackpot'], new_trophies: ['jackpot'] }),
    R(2, { gifts_given: 2, mairie_ok: 1, feats: ['maire_vereux'] }), R(3, { killed_round: 1, nights: 1, feats: ['mauvais_endroit', 'fantome_rancunier'], new_trophies: ['premiere_partie'] }),
    R(4, { tokens: 6, gifts_received: 2, casino_bets: 3, casino_net: -4, feats: ['ruine'] }), R(5), R(6, { eliminated_round: 2, feats: ['bouc_emissaire'] }),
  ],
  nights: [
    { round: 1, moves: [{ player_id: 'p0', location: 'taverne' }, { player_id: 'p3', location: 'taverne' }, { player_id: 'p1', location: 'casino' }, { player_id: 'p4', location: 'casino' }, { player_id: 'p2', location: 'mairie' }, { player_id: 'p5', location: 'maison' }, { player_id: 'p6', location: 'poste_garde' }],
      deaths: [{ player_id: 'p3', location: 'taverne' }], sabotages: [], rigs: [{ player_id: 'p2', kind: 'boost', target_id: 'p6' }] },
    { round: 2, moves: [{ player_id: 'p0', location: 'planque' }, { player_id: 'p1', location: 'casino' }, { player_id: 'p4', location: 'taverne' }, { player_id: 'p2', location: 'taverne' }, { player_id: 'p5', location: 'cimetiere' }, { player_id: 'p6', location: 'maison' }],
      deaths: [], sabotages: [{ player_id: 'p0', location: 'casino', success: true }], rigs: [] },
  ],
  votes: [
    { round: 1, eliminated_id: null, eliminated_team: null, tally: {}, tied: true, runoffs: 3, drawn: false },
    { round: 2, eliminated_id: 'p6', eliminated_team: 'villageois', tally: {}, tied: false, runoffs: 1, drawn: false },
  ],
}

export default function Demo() {
  const [tab, setTab] = useState<'role' | 'action' | 'rules'>('action')
  const [haunt, setHaunt] = useState<string | null>('casino')
  const [vote, setVote] = useState<string | null | undefined>(undefined)
  const noop = () => undefined
  return (
    <Screen>
      <TitleBar title="Vitrine" right={<TokenBadge count={3} />} />
      <div className="px-frame flex flex-wrap items-end gap-3 p-3">
        {AVATARS.map((_, i) => <Avatar key={i} index={i} kind="body" scale={3} style={{ animationDelay: `${i * 120}ms` }} />)}
      </div>
      <div className="px-frame flex flex-wrap items-center gap-3 p-3">
        {AVATARS.map((_, i) => <Avatar key={i} index={i} scale={3} ring />)}
        {['coin', 'crown', 'ghost', 'moon', 'sun', 'skull', 'check', 'lock'].map((n) => <Px key={n} name={n} scale={3} />)}
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'role', label: 'Mon rôle' }, { id: 'action', label: 'Ma nuit' }, { id: 'rules', label: 'Règles' }]} />
      <div className="flex gap-2"><Button>Primaire</Button><Button variant="secondary">Secondaire</Button><Button variant="danger">Danger</Button><Button variant="ghost">Lien</Button></div>
      <Note>Tu fais mieux que 71 % des joueurs.</Note>
      <Note tone="danger">⚠️ Mort subite : les Saboteurs sont aussi nombreux que les autres.</Note>
      <RoleCard role={SIMPLE_ROLES[0]} tokens={2} />
      <RoleCard role={SIMPLE_ROLES[1]} tokens={3} allies={[players[1]]} />
      <HoldToReveal><RoleCard role={SIMPLE_ROLES[0]} tokens={1} /></HoldToReveal>
      <RoleCard role={SOLO_ROLES[0]} tokens={6} />
      <SolitairePanel secret={{ player_id: 'p4', role_id: 'capitaliste', team: 'solitaires', tokens: 6 }} alive canAct goal={10} switchCost={2} onSide={noop} />
      <RoleCard role={SOLO_ROLES[1]} tokens={3} />
      <SolitairePanel secret={{ player_id: 'p4', role_id: 'opportuniste', team: 'solitaires', tokens: 3, side: 'saboteurs' }} alive canAct goal={10} switchCost={2} onSide={noop} />
      <SettingsPanel settings={{ solitaires_on: 1, timers_on: 0, capitaliste_goal: 12 }} editable onChange={noop} onReset={noop} />
      <NightPanel player={me} others={players.filter((p) => p.is_alive && p.id !== me.id)} tokens={3} saboteurs={2} isSaboteur choice={undefined} closed={['casino', 'cimetiere']} ghosts={[players[3]]} namedCemetery allyInfo={[{ name: 'Jeanne', location: 'taverne', validated: false }]} onValidate={noop} onCancel={noop} />
      <GhostPanel mode="night" round={2} self={players[3]} report={{ ghost: true, watches: [], suspect: null, tomb: null, haunt }} players={players} onWatch={noop} onHint={noop} tombCount={3} onTomb={noop} namedCemetery isSaboteur hauntPct={25} onHaunt={setHaunt} />
      <GhostPanel mode="info" round={2} self={players[3]} report={{ ghost: true, watches: [{ round: 1, target_id: 'p1', location: 'taverne' }], suspect: 'p2', tomb: null }} players={players} onWatch={noop} onHint={noop} tombCount={3} onTomb={noop} namedCemetery isSaboteur={false} hauntPct={25} onHaunt={noop} />
      <VotePanel player={me} others={players.filter((p) => p.is_alive && p.id !== me.id)} choice={vote} onVote={(t) => setVote(t)} onCancel={() => setVote(undefined)} />
      <DayPanel players={players} report={{ location: 'taverne', present: ['p1', 'p2'], result: { rumeur: { targets: ['p1', 'p2', 'p6'], has_saboteur: true } }, closed_next: [], cry: false, killed: false, deaths: [{ player_id: 'p3', location: null }] }} />
      <DayPanel players={players} report={{ location: 'poste_garde', present: [], result: {}, closed_next: [], cry: false, killed: false, deaths: [] }} />
      <ResultPanel players={players} result={{ room_id: 'r', round: 2, eliminated_id: 'p3', eliminated_team: 'saboteurs', tied: false, tally: { p3: 4, p1: 2 }, runoffs: 0, drawn: false }} />
      <EndPanel demoRecap={demoRecap} meId={me.id} winner="villageois" players={players} roles={players.map((p, i) => ({ player_id: p.id, role_id: i % 3 === 0 ? 'saboteur_simple' : 'villageois_simple', team: i % 3 === 0 ? 'saboteurs' : 'villageois' }))} />
    </Screen>
  )
}
