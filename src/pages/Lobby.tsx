import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Screen } from '../components/ui'
import { AVATARS } from '../data/avatars'
import { useRoom } from '../hooks/useRoom'
import { addBot, clearLastRoom, errorMessage, leaveRoom, removeBot, startGame } from '../lib/api'

export default function Lobby() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { state, room, players, me, refresh } = useRoom(code)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (room?.status === 'playing') navigate(`/partie/${code}`, { replace: true })
  }, [room?.status, code, navigate])

  if (state === 'loading') {
    return <Screen><p className="text-center text-slate-400 mt-24">Chargement…</p></Screen>
  }
  if (state === 'notfound' || !room) return <Navigate to={`/rejoindre/${code}`} replace />

  const canStart = players.length >= 4

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function share() {
    const link = `${location.origin}/rejoindre/${room!.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Bluff', text: `Rejoins ma partie ! Code : ${room!.code}`, url: link })
      } catch { /* partage annulé */ }
    } else {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function leave() {
    try { await leaveRoom(room!.id) } catch { /* déjà parti */ }
    clearLastRoom()
    navigate('/')
  }

  return (
    <Screen>
      <div className="text-center mt-4">
        <p className="text-slate-400 text-sm">Code du salon</p>
        <p className="text-6xl font-bold tracking-[0.25em] mt-1">{room.code}</p>
        <button onClick={share} className="mt-3 text-violet-400 hover:text-violet-300">
          {copied ? 'Lien copié ✓' : 'Partager le lien'}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <h2 className="font-semibold">Joueurs ({players.length}/10)</h2>
        <Link to="/roles" className="text-sm text-slate-400 hover:text-white">Voir les rôles</Link>
      </div>

      <ul className="flex flex-col gap-2">
        {players.map((p) => {
          const a = AVATARS[p.avatar]
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-xl" style={{ backgroundColor: a.color }}>
                {a.emoji}
              </span>
              <span className="flex-1 font-medium">
                {p.nickname}
                {p.id === me?.id && <span className="text-slate-500"> (toi)</span>}
                {p.is_bot && <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">bot</span>}
              </span>
              {p.is_host && <span title="Hôte">👑</span>}
              {p.is_bot && me?.is_host && (
                <button onClick={() => run(() => removeBot(p.id))} aria-label="Retirer le bot" className="text-slate-500 hover:text-white">
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {room.debug && me?.is_host && (
        <Button variant="secondary" disabled={players.length >= 10} onClick={() => run(() => addBot(room.id))}>
          ＋ Ajouter un bot (debug)
        </Button>
      )}

      {error && <p className="text-red-400">{error}</p>}

      {me?.is_host ? (
        <Button disabled={!canStart} onClick={() => run(() => startGame(room.id))}>
          Lancer la partie
        </Button>
      ) : (
        <p className="text-center text-slate-400">En attente de l’hôte…</p>
      )}
      {!canStart && <p className="text-center text-sm text-slate-500">Il faut au moins 4 joueurs pour commencer.</p>}

      <Button variant="ghost" onClick={leave}>Quitter le salon</Button>
    </Screen>
  )
}