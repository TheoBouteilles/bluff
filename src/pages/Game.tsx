import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import DayPanel from '../components/DayPannel'
import EndPanel from '../components/EndPannel'
import GhostPanel from '../components/GhostPannel'
import HoldToReveal from '../components/HoldToReveal'
import NightPanel from '../components/NightPannel'
import ResultPanel from '../components/ResultPannel'
import RoleCard from '../components/RoleCard'
import RulesPanel from '../components/RulesPanel'
import VotePanel from '../components/VotePannel'
import { Button, Note, Screen, Tabs, TokenBadge, panelClass } from '../components/ui'
import { Avatar, Px } from '../components/Px'
import { getRole } from '../data/roles'
import { useAllies } from '../hooks/useAllies'
import { useCountdown } from '../hooks/useCountdown'
import { useClosures } from '../hooks/useClosures'
import { useDawnReport } from '../hooks/useDawnReport'
import { useGhostReport } from '../hooks/useGhostReport'
import { useNightChoices } from '../hooks/useNightChoices'
import { useNightProgress } from '../hooks/useNightProgress'
import { useRoom } from '../hooks/useRoom'
import { useRoomSettings } from '../hooks/useRoomSettings'
import { useSaboteurVision } from '../hooks/useSaboteurVision'
import { useSecrets } from '../hooks/useSecrets'
import { useFinalRoles, useVoteChoices, useVoteProgress, useVoteResults } from '../hooks/useVotes'
import { advancePhase, cancelNightAction, setNightDraft, cancelVote, errorMessage, resetRoom, setGhostHaunt, setGhostHint, setGhostTomb, submitGhostWatch, submitNightAction, submitVote } from '../lib/api'
import type { NightParams } from '../lib/api'
import type { Player } from '../types'

export default function Game() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { state, room, players, me, refresh } = useRoom(code)
  const playing = room?.status === 'playing'
  const cfg = useRoomSettings(room?.id)
  const round = room?.round ?? 0
  const { secrets, ready, reload } = useSecrets(players.map((p) => p.id), playing, `${round}-${room?.phase}`)
  const [viewAs, setViewAs] = useState<string | null>(null)
  const [tab, setTab] = useState<'role' | 'action' | 'rules'>('role')
  const [error, setError] = useState('')

  const debugHost = !!room?.debug && !!me?.is_host
  const viewable = debugHost ? players.filter((p) => p.id === me?.id || p.is_bot) : me ? [me] : []
  const targetId = viewAs && viewable.some((p) => p.id === viewAs) ? viewAs : me?.id
  const target = players.find((p) => p.id === targetId)
  const secret = targetId ? secrets[targetId] : undefined
  const role = secret ? getRole(secret.role_id) : undefined

  const secondsLeft = useCountdown(room?.phase_ends_at ?? null)
  const expired = playing && !!room?.phase_ends_at && secondsLeft === 0
  const { choices, reload: reloadChoices } = useNightChoices(room?.id, round, playing && round > 0)
  const progress = useNightProgress(room?.id, playing && room?.phase === 'night' && !!me?.is_host, choices)
  const voteChoices = useVoteChoices(room?.id, round, playing && room?.phase === 'vote')
  const voteProgress = useVoteProgress(room?.id, playing && room?.phase === 'vote' && !!me?.is_host, voteChoices.choices)
  const voteResults = useVoteResults(room?.id, playing && round > 0, `${round}-${room?.phase}`)
  const finalRoles = useFinalRoles(room?.id, playing && room?.phase === 'ended')
  const closed = useClosures(room?.id, round, playing && room?.phase === 'night')
  const report = useDawnReport(room?.id, round, playing && room?.phase === 'day', targetId)
  const ghost = useGhostReport(room?.id, targetId, playing && !!target && !target.is_alive, `${round}-${room?.phase}`)
  const vision = useSaboteurVision(room?.id, targetId, playing && room?.phase === 'night' && secret?.team === 'saboteurs' && (cfg.settings.saboteur_vision ?? 1) === 1)
  const allyIds = useAllies(room?.id, targetId, playing && secret?.team === 'saboteurs')

  useEffect(() => {
    if (room?.status === 'lobby') navigate(`/salon/${code}`, { replace: true })
  }, [room?.status, code, navigate])

  // Minuteur écoulé : chaque client demande la suite, le serveur n'agit qu'une seule fois
  useEffect(() => {
    if (!expired || !room) return
    const call = () => {
      advancePhase(room.id).catch(() => undefined)
    }
    call()
    const id = setInterval(call, 3000)
    return () => clearInterval(id)
  }, [expired, room?.id, room?.phase, room?.round])

  // Dès la 2e manche, ou le jour, on ouvre directement l'onglet d'action
  useEffect(() => {
    if (room && (room.phase !== 'night' || room.round > 1)) setTab('action')
  }, [room?.phase, room?.round])

  if (state === 'loading') {
    return <Screen><p className="mt-24 text-center text-mist-d">Chargement…</p></Screen>
  }
  if (state === 'notfound' || !room || !me || !target) {
    return <Navigate to={`/rejoindre/${code}`} replace />
  }

  const roomId = room.id
  const tId = target.id
  const tIsMe = target.id === me.id
  const allies = allyIds
    ? allyIds.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p)
    : null
  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function choose(location: string, params: NightParams = {}) {
    await run(async () => {
      await submitNightAction(roomId, location, tIsMe ? undefined : tId, params)
      await reloadChoices()
    })
  }

  function draftNight(loc: string | null) {
    if (secret?.team === 'saboteurs' && (cfg.settings.saboteur_vision ?? 1) === 1) {
      setNightDraft(roomId, loc, tIsMe ? undefined : tId).catch(() => undefined)
    }
  }

  async function unchoose() {
    await run(async () => {
      await cancelNightAction(roomId, tIsMe ? undefined : tId)
      await reloadChoices()
    })
  }

  async function unvote() {
    await run(async () => {
      await cancelVote(roomId, tIsMe ? undefined : tId)
      await voteChoices.reload()
    })
  }

  async function watchGhost(targetId: string) {
    await run(async () => {
      await submitGhostWatch(roomId, targetId, tIsMe ? undefined : tId)
      await ghost.reload()
    })
  }

  async function hintGhost(suspectId: string | null) {
    await run(async () => {
      await setGhostHint(roomId, suspectId, tIsMe ? undefined : tId)
      await ghost.reload()
    })
  }

  async function hauntGhost(allyId: string | null) {
    await run(async () => {
      await setGhostHaunt(roomId, allyId, tIsMe ? undefined : tId)
      await ghost.reload()
    })
  }

  async function tombGhost(tomb: number) {
    if (!window.confirm(`Choisir la tombe n°${tomb} ? Ce choix est définitif.`)) return
    await run(async () => {
      await setGhostTomb(roomId, tomb, tIsMe ? undefined : tId)
      await ghost.reload()
    })
  }

  async function castVote(targetId: string | null) {
    await run(async () => {
      await submitVote(roomId, targetId, tIsMe ? undefined : tId)
      await voteChoices.reload()
    })
  }

  const namedCemetery = (cfg.settings.cemetery_named ?? 1) === 1
  const ghostExtra = {
    namedCemetery,
    isSaboteur: secret?.team === 'saboteurs',
    allies: (allies ?? []).filter((p) => p.is_alive),
    hauntPct: (cfg.settings.ghost_haunt_on ?? 1) === 1 ? (cfg.settings.ghost_haunt_bonus_pct ?? 25) : null,
    onHaunt: hauntGhost,
    allyLocation: vision ? (id: string) => vision.allies.find((a) => a.player_id === id)?.location : undefined,
  }
  const notReady =
    (room.phase === 'night' && !!progress && progress.played < progress.total) ||
    (room.phase === 'vote' && !!voteProgress && voteProgress.played < voteProgress.total)

  const PHASE_LABEL: Record<string, string> = { night: 'Nuit', day: 'Jour', vote: 'Vote', result: 'Résultat', ended: 'Fin de partie' }
  const TAB_LABEL: Record<string, string> = { night: 'Ma nuit', day: 'Aube et débat', vote: 'Mon vote', result: 'Résultat', ended: 'Fin' }
  const alivePlayers = players.filter((p) => p.is_alive)
  const resultOfRound = voteResults.find((v) => v.round === room.round)
  const teamRevealed = (id: string) => voteResults.find((v) => v.eliminated_id === id)?.eliminated_team

  async function backToLobby() {
    if (!window.confirm('Retourner au salon ? Les rôles seront redistribués au prochain lancement.')) return
    await run(() => resetRoom(roomId))
  }

  return (
    <Screen>
      <div className={`${panelClass} flex items-center justify-between px-3 py-2`}>
        <div className="flex items-center gap-3">
          <Px name={room.phase === 'night' ? 'moon' : 'sun'} scale={3} className="animate-float" />
          <div>
            <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-mist-d">Manche {room.round}</p>
            <p className="font-display text-2xl font-bold uppercase leading-none tracking-wider text-paper">
              {PHASE_LABEL[room.phase] ?? room.phase}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {room.phase_ends_at && (
            <span className={`font-display text-2xl tabular-nums ${secondsLeft <= 10 ? 'animate-blink-slow text-blood' : 'text-sand'}`}>
              {mm}:{ss}
            </span>
          )}
          {secret && <TokenBadge count={secret.tokens} />}
        </div>
      </div>

      {room.sudden_death && room.phase !== 'ended' && (
        <p className="animate-shake border-2 border-blood bg-blood/15 p-3 font-sans text-sm text-[#f0b4ae]">
          ⚠️ Mort subite : les Saboteurs sont aussi nombreux que les autres. Si aucun Saboteur n’est éliminé au prochain vote, ils gagnent.
        </p>
      )}

      {debugHost && (
        <div className="bg-night-2 p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-mist-d">Debug : voir en tant que</p>
          <div className="flex flex-wrap gap-2">
            {viewable.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewAs(p.id)}
                className={`px-3 py-1 text-sm ${
                  p.id === targetId ? 'bg-paper text-ink' : 'bg-night'
                }`}
              >
                <Avatar index={p.avatar} scale={1} className="mr-1 inline align-middle" /> {p.id === me.id ? 'Moi' : p.nickname}
              </button>
            ))}
          </div>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'role', label: 'Mon rôle' },
          { id: 'action', label: TAB_LABEL[room.phase] ?? 'Action' },
          { id: 'rules', label: 'Règles' },
        ]}
      />

      {tab === 'rules' ? (
        <RulesPanel settings={cfg.settings} />
      ) : tab === 'role' ? (
        !ready ? (
          <p className="text-center text-mist-d">Chargement…</p>
        ) : !secret || !role ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-mist-d">Rôle introuvable pour le moment.</p>
            <Button variant="secondary" onClick={reload}>Réessayer</Button>
          </div>
        ) : target.is_bot ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-mist-d">Vue debug de {target.nickname} (affichage direct)</p>
            <RoleCard role={role} tokens={secret.tokens} allies={allies} />
          </div>
        ) : (
          <HoldToReveal>
            <RoleCard role={role} tokens={secret.tokens} allies={allies} />
          </HoldToReveal>
        )
      ) : room.phase === 'ended' ? (
        <EndPanel winner={room.winner} roles={finalRoles} players={players} />
      ) : room.phase === 'result' ? (
        <ResultPanel result={resultOfRound} players={players} />
      ) : room.phase === 'vote' ? (
        <VotePanel
          key={tId}
          player={target}
          others={alivePlayers.filter((p) => p.id !== tId && (!room.vote_candidates || room.vote_candidates.includes(p.id)))}
          runoff={room.vote_candidates ? { step: room.vote_step, names: room.vote_candidates.map((id) => players.find((p) => p.id === id)?.nickname ?? '?') } : undefined}
          choice={voteChoices.choices[tId]}
          onVote={castVote}
          onCancel={unvote}
        />
      ) : room.phase === 'night' && !target.is_alive ? (
        <GhostPanel mode="night" round={room.round} self={target} report={ghost.report} players={players} onWatch={watchGhost} onHint={hintGhost} tombCount={cfg.settings.tomb_count ?? 3} onTomb={tombGhost} {...ghostExtra} />
      ) : room.phase === 'night' ? (
        <NightPanel
          key={tId}
          player={target}
          others={players.filter((p) => p.is_alive && p.id !== tId)}
          tokens={secret?.tokens ?? 0}
          totalPlayers={players.length}
          isSaboteur={secret?.team === 'saboteurs'}
          choice={choices[tId]}
          closed={players.some((p) => !p.is_alive) ? closed : [...closed, 'cimetiere']}
          ghosts={players.filter((p) => !p.is_alive && teamRevealed(p.id) !== 'saboteurs')}
          namedCemetery={namedCemetery}
          allyInfo={vision ? [...vision.allies.map((a) => a.player_id), ...(vision.haunts.some((h) => h.ally_id === tId) ? [tId] : [])].map((id) => ({
            name: id === tId ? 'Toi' : players.find((p) => p.id === id)?.nickname ?? '?',
            location: id === tId ? choices[tId]?.location ?? null : vision.allies.find((a) => a.player_id === id)?.location ?? null,
            validated: id === tId ? !!choices[tId] : !!vision.allies.find((a) => a.player_id === id)?.validated,
            haunted: vision.haunts.filter((h) => h.ally_id === id).map((h) => players.find((p) => p.id === h.ghost_id)?.nickname ?? '?'),
          })) : undefined}
          onDraft={draftNight}
          onValidate={choose}
          onCancel={unchoose}
        />
      ) : (
        <DayPanel report={report} players={players} />
      )}

      {!target.is_alive && room.phase !== 'night' && room.phase !== 'ended' && (
        <GhostPanel mode="info" round={room.round} self={target} report={ghost.report} players={players} onWatch={watchGhost} onHint={hintGhost} tombCount={cfg.settings.tomb_count ?? 3} onTomb={tombGhost} {...ghostExtra} />
      )}

      {error && <Note tone="danger">{error}</Note>}

      <section className={`${panelClass} mt-2 p-3`}>
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-[0.2em] text-mist-d">Joueurs ({players.length})</p>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id} className={`flex items-center gap-2 border-2 border-night-3 bg-night px-2 py-1 font-sans text-sm ${p.is_alive ? '' : 'opacity-70'}`}>
              {p.is_alive ? <Avatar index={p.avatar} scale={1} /> : <Px name="ghost" scale={1} />}
              <span className={p.is_alive ? 'text-paper' : 'text-mist-d line-through'}>{p.nickname}</span>
              {!p.is_alive && teamRevealed(p.id) && <Px name={`team_${teamRevealed(p.id)}_s`} scale={1} title={teamRevealed(p.id) === 'saboteurs' ? 'Saboteur' : teamRevealed(p.id) === 'villageois' ? 'Villageois' : 'Solitaire'} />}
            </li>
          ))}
        </ul>
      </section>

      {me.is_host && room.phase !== 'ended' && (
        <Button disabled={notReady} onClick={() => run(() => advancePhase(roomId, true))}>
          {room.phase === 'night'
            ? `Résoudre la nuit${progress ? ` (${progress.played}/${progress.total} ont validé)` : ''}`
            : room.phase === 'day'
              ? 'Ouvrir le vote'
              : room.phase === 'vote'
                ? `Dépouiller le vote${voteProgress ? ` (${voteProgress.played}/${voteProgress.total} ont validé)` : ''}`
                : 'Passer à la nuit suivante'}
        </Button>
      )}
      {me.is_host && (
        <Button variant="ghost" onClick={backToLobby}>Retour au salon (nouvelle distribution)</Button>
      )}
    </Screen>
  )
}