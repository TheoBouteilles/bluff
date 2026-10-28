import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import DayPanel from '../components/DayPannel'
import HoldToReveal from '../components/HoldToReveal'
import NightPanel from '../components/NightPannel'
import RoleCard from '../components/RoleCard'
import { Button, Screen, TokenBadge, panelClass } from '../components/ui'
import { AVATARS } from '../data/avatars'
import { getRole } from '../data/roles'
import { useAllies } from '../hooks/useAllies'
import { useCountdown } from '../hooks/useCountdown'
import { useClosures } from '../hooks/useClosures'
import { useDawnReport } from '../hooks/useDawnReport'
import { useNightChoices } from '../hooks/useNightChoices'
import { useRoom } from '../hooks/useRoom'
import { useSecrets } from '../hooks/useSecrets'
import { advancePhase, errorMessage, resetRoom, submitNightAction } from '../lib/api'
import type { NightParams } from '../lib/api'
import type { Player } from '../types'

export default function Game() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { state, room, players, me, refresh } = useRoom(code)
  const playing = room?.status === 'playing'
  const round = room?.round ?? 0
  const { secrets, ready, reload } = useSecrets(players.map((p) => p.id), playing, `${round}-${room?.phase}`)
  const [viewAs, setViewAs] = useState<string | null>(null)
  const [tab, setTab] = useState<'role' | 'action'>('role')
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
  const closed = useClosures(room?.id, round, playing && room?.phase === 'night')
  const report = useDawnReport(room?.id, round, playing && room?.phase === 'day', targetId)
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
    if (room && (room.phase === 'day' || room.round > 1)) setTab('action')
  }, [room?.phase, room?.round])

  if (state === 'loading') {
    return <Screen><p className="mt-24 text-center text-stone-400">Chargement…</p></Screen>
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

  async function backToLobby() {
    if (!window.confirm('Retourner au salon ? Les rôles seront redistribués au prochain lancement.')) return
    await run(() => resetRoom(roomId))
  }

  return (
    <Screen>
      <div className={`${panelClass} flex items-center justify-between px-4 py-3`}>
        <div className="flex items-center gap-3">
          {room.phase === 'night' ? (
            <Moon className="text-amber-400" />
          ) : (
            <Sun className="text-amber-400" />
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400">Manche {room.round}</p>
            <p className="font-display text-xl font-bold text-amber-100">
              {room.phase === 'night' ? 'Nuit' : 'Jour'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xl tabular-nums ${secondsLeft <= 10 ? 'text-red-400' : ''}`}>
            {mm}:{ss}
          </span>
          {secret && <TokenBadge count={secret.tokens} />}
        </div>
      </div>

      {debugHost && (
        <div className="rounded-xl bg-stone-900 p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-stone-500">Debug : voir en tant que</p>
          <div className="flex flex-wrap gap-2">
            {viewable.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewAs(p.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  p.id === targetId ? 'bg-amber-600 text-stone-950' : 'bg-stone-800'
                }`}
              >
                {AVATARS[p.avatar].emoji} {p.id === me.id ? 'Moi' : p.nickname}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === 'role' ? 'primary' : 'secondary'} onClick={() => setTab('role')}>
          Mon rôle
        </Button>
        <Button variant={tab === 'action' ? 'primary' : 'secondary'} onClick={() => setTab('action')}>
          {room.phase === 'night' ? 'Ma nuit' : 'Aube et débat'}
        </Button>
      </div>

      {tab === 'role' ? (
        !ready ? (
          <p className="text-center text-stone-400">Chargement…</p>
        ) : !secret || !role ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-stone-400">Rôle introuvable pour le moment.</p>
            <Button variant="secondary" onClick={reload}>Réessayer</Button>
          </div>
        ) : target.is_bot ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-stone-500">Vue debug de {target.nickname} (affichage direct)</p>
            <RoleCard role={role} tokens={secret.tokens} allies={allies} />
          </div>
        ) : (
          <HoldToReveal>
            <RoleCard role={role} tokens={secret.tokens} allies={allies} />
          </HoldToReveal>
        )
      ) : room.phase === 'night' ? (
        <NightPanel
          key={tId}
          player={target}
          others={players.filter((p) => p.is_alive && p.id !== tId)}
          tokens={secret?.tokens ?? 0}
          isSaboteur={secret?.team === 'saboteurs'}
          choice={choices[tId]}
          closed={closed}
          onChoose={choose}
        />
      ) : (
        <DayPanel report={report} players={players} />
      )}

      {error && <p className="text-red-400">{error}</p>}

      <section className="mt-2">
        <h2 className="mb-2 font-semibold">Joueurs ({players.length})</h2>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1 text-sm">
              <span>{AVATARS[p.avatar].emoji}</span>
              <span>{p.nickname}</span>
            </li>
          ))}
        </ul>
      </section>

      {debugHost && (
        <Button variant="secondary" onClick={() => run(() => advancePhase(roomId, true))}>
          Forcer la phase suivante (debug)
        </Button>
      )}
      {me.is_host && (
        <Button variant="ghost" onClick={backToLobby}>Retour au salon (nouvelle distribution)</Button>
      )}
    </Screen>
  )
}