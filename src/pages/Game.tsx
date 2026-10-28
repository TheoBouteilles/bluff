import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import HoldToReveal from '../components/HoldToReveal'
import RoleCard from '../components/RoleCard'
import { Button, Screen } from '../components/ui'
import { AVATARS } from '../data/avatars'
import { getRole } from '../data/roles'
import { useRoom } from '../hooks/useRoom'
import { useSecrets } from '../hooks/useSecrets'
import { errorMessage, resetRoom } from '../lib/api'

export default function Game() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { state, room, players, me } = useRoom(code)
  const playing = room?.status === 'playing'
  const { secrets, ready, reload } = useSecrets(players.map((p) => p.id), playing)
  const [viewAs, setViewAs] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (room?.status === 'lobby') navigate(`/salon/${code}`, { replace: true })
  }, [room?.status, code, navigate])

  if (state === 'loading') {
    return <Screen><p className="mt-24 text-center text-slate-400">Chargement…</p></Screen>
  }
  if (state === 'notfound' || !room || !me) return <Navigate to={`/rejoindre/${code}`} replace />

  const debugHost = room.debug && me.is_host
  const viewable = debugHost ? players.filter((p) => p.id === me.id || p.is_bot) : [me]
  const targetId = viewAs && viewable.some((p) => p.id === viewAs) ? viewAs : me.id
  const target = players.find((p) => p.id === targetId) ?? me
  const secret = secrets[targetId]
  const role = secret ? getRole(secret.role_id) : undefined

  async function backToLobby() {
    if (!window.confirm('Retourner au salon ? Les rôles seront redistribués au prochain lancement.')) return
    setError('')
    try {
      await resetRoom(room!.id)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Screen>
      <div className="text-center">
        <p className="text-sm text-slate-400">Salon {room.code}</p>
        <h1 className="text-2xl font-bold">Ton rôle secret</h1>
      </div>

      {debugHost && (
        <div className="rounded-xl bg-slate-900 p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Debug : voir en tant que</p>
          <div className="flex flex-wrap gap-2">
            {viewable.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewAs(p.id)}
                className={`rounded-full px-3 py-1 text-sm ${p.id === targetId ? 'bg-violet-600' : 'bg-slate-800'}`}
              >
                {AVATARS[p.avatar].emoji} {p.id === me.id ? 'Moi' : p.nickname}
              </button>
            ))}
          </div>
        </div>
      )}

      {!ready ? (
        <p className="text-center text-slate-400">Distribution en cours…</p>
      ) : !secret || !role ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-slate-400">Rôle introuvable pour le moment.</p>
          <Button variant="secondary" onClick={reload}>Réessayer</Button>
        </div>
      ) : target.is_bot ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-slate-500">Vue debug de {target.nickname} (affichage direct)</p>
          <RoleCard role={role} tokens={secret.tokens} />
        </div>
      ) : (
        <HoldToReveal>
          <RoleCard role={role} tokens={secret.tokens} />
        </HoldToReveal>
      )}

      <section className="mt-2">
        <h2 className="mb-2 font-semibold">Joueurs ({players.length})</h2>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-sm">
              <span>{AVATARS[p.avatar].emoji}</span>
              <span>{p.nickname}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-slate-500">La phase de nuit arrive en phase 3.</p>

      {error && <p className="text-red-400">{error}</p>}
      {me.is_host && <Button variant="ghost" onClick={backToLobby}>Retour au salon (nouvelle distribution)</Button>}
    </Screen>
  )
}