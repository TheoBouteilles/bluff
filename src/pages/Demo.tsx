import { useState } from 'react'
import DayPanel from '../components/DayPannel'
import EndPanel from '../components/EndPannel'
import HoldToReveal from '../components/HoldToReveal'
import NightPanel from '../components/NightPannel'
import { Avatar, Px } from '../components/Px'
import ResultPanel from '../components/ResultPannel'
import RoleCard from '../components/RoleCard'
import { Button, Note, Screen, Tabs, TitleBar, TokenBadge } from '../components/ui'
import VotePanel from '../components/VotePannel'
import { AVATARS } from '../data/avatars'
import { SIMPLE_ROLES } from '../data/roles'
import type { Player } from '../types'

/*
 * Vitrine de l'interface avec des données factices (dev uniquement, route /demo).
 * Sert à vérifier le rendu des composants sans partie en cours ni Supabase.
 */
const P = (i: number, n: string, alive = true, host = false): Player => ({
  id: `p${i}`, room_id: 'r', user_id: null, nickname: n, avatar: i, is_host: host, is_bot: false, is_alive: alive, joined_at: '',
})
const players = [P(0, 'Marcel', true, true), P(1, 'Jeanne'), P(2, 'Ahmed'), P(3, 'Lucie', false), P(4, 'Théo'), P(5, 'Nina'), P(6, 'Paul')]
const me = players[4]

export default function Demo() {
  const [tab, setTab] = useState<'role' | 'action' | 'rules'>('action')
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
      <NightPanel player={me} others={players.filter((p) => p.is_alive && p.id !== me.id)} tokens={3} totalPlayers={7} isSaboteur choice={undefined} closed={['casino']} ghosts={[players[3]]} namedCemetery allyInfo={[{ name: 'Jeanne', location: 'taverne', validated: false, haunted: [] }]} onValidate={noop} onCancel={noop} />
      <VotePanel player={me} others={players.filter((p) => p.is_alive && p.id !== me.id)} choice={vote} onVote={(t) => setVote(t)} onCancel={() => setVote(undefined)} />
      <DayPanel players={players} report={{ location: 'taverne', present: ['p1', 'p2'], result: { rumeur: { targets: ['p1', 'p2', 'p6'], has_saboteur: true } }, closed_next: [], cry: false, killed: false, deaths: [{ player_id: 'p3', location: null }] }} />
      <ResultPanel players={players} result={{ room_id: 'r', round: 2, eliminated_id: 'p3', eliminated_team: 'saboteurs', tied: false, tally: { p3: 4, p1: 2 }, runoffs: 0, drawn: false }} />
      <EndPanel winner="villageois" players={players} roles={players.map((p, i) => ({ player_id: p.id, role_id: i % 3 === 0 ? 'saboteur_simple' : 'villageois_simple', team: i % 3 === 0 ? 'saboteurs' : 'villageois' }))} />
    </Screen>
  )
}
