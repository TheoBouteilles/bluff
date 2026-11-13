import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import SettingsPanel from '../components/SettingsPanel'
import BackLink from '../components/BackLink'
import { Avatar, Px } from '../components/Px'
import { Button, Label, Note, Screen, TitleBar } from '../components/ui'
import { useRoom } from '../hooks/useRoom'
import { useRoomSettings } from '../hooks/useRoomSettings'
import { addBot, clearLastRoom, errorMessage, leaveRoom, removeBot, resetRoomSettings, startGame, updateRoomSettings } from '../lib/api'

export default function Lobby() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { state, room, players, me, refresh } = useRoom(code)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const cfg = useRoomSettings(room?.id)

  useEffect(() => {
    if (room?.status === 'playing') navigate(`/partie/${code}`, { replace: true })
  }, [room?.status, code, navigate])

  if (state === 'loading') {
    return <Screen><p className="text-center text-mist-d mt-24">Chargement…</p></Screen>
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
      <TitleBar
        title="Salon"
        left={<BackLink label="Quitter" onClick={leave} />}
        right={
          <>
            <Link to={`/regles?salon=${room.code}`} className="font-pixel text-[11px] uppercase tracking-wider text-gold underline decoration-2 underline-offset-4">Règles</Link>
            <Link to="/roles" className="font-pixel text-[11px] uppercase tracking-wider text-mist underline decoration-2 underline-offset-4">Rôles</Link>
          </>
        }
      />

      <div className="px-frame-paper flex flex-col items-center gap-1 px-4 py-4 text-center">
        <Label className="!text-ink/60">Code du salon</Label>
        <p className="font-display text-6xl font-bold tracking-[0.25em] [text-shadow:3px_3px_0_var(--color-sand)]">{room.code}</p>
        <button onClick={share} className="mt-1 font-pixel text-[11px] uppercase tracking-wider text-sea underline decoration-2 underline-offset-4">
          {copied ? 'Lien copié ✓' : 'Partager le lien'}
        </button>
      </div>

      <div className="px-frame p-3">
        <Label className="mb-2">Joueurs ({players.length}/10)</Label>
        <ul className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-2 border-night-3 bg-night px-2 py-2 animate-rise">
              <Avatar index={p.avatar} kind="body" scale={2} />
              <span className="min-w-0 flex-1 font-sans text-sm leading-tight">
                <span className="block truncate font-semibold text-paper">{p.nickname}</span>
                <span className="block font-pixel text-[9px] uppercase tracking-wider text-mist-d">
                  {p.is_host ? 'Hôte' : p.is_bot ? 'Bot' : p.id === me?.id ? 'Toi' : 'Joueur'}
                </span>
              </span>
              {p.is_host && <Px name="crown" scale={1} title="Hôte" />}
              {p.is_bot && me?.is_host && (
                <button onClick={() => run(() => removeBot(p.id))} aria-label="Retirer le bot" className="font-pixel text-xs text-mist-d hover:text-blood">
                  ✕
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
            <li key={`empty-${i}`} className="flex items-center justify-center border-2 border-dashed border-night-3 px-2 py-3 font-pixel text-[9px] uppercase tracking-wider text-mist-d">
              en attente…
            </li>
          ))}
        </ul>
      </div>

      {room.debug && me?.is_host && (
        <Button variant="secondary" disabled={players.length >= 10} onClick={() => run(() => addBot(room.id))}>
          ＋ Ajouter un bot (debug)
        </Button>
      )}

      <SettingsPanel
        settings={cfg.settings}
        editable={!!me?.is_host}
        onChange={(key, value) => {
          cfg.apply({ ...cfg.settings, [key]: value })
          run(() => updateRoomSettings(room.id, { [key]: value }).then(cfg.apply))
        }}
        onReset={() => run(() => resetRoomSettings(room.id).then(cfg.apply))}
      />

      {error && <Note tone="danger">{error}</Note>}

      {me?.is_host ? (
        <Button disabled={!canStart} onClick={() => run(() => startGame(room.id))}>
          Lancer la partie
        </Button>
      ) : (
        <p className="animate-blink-slow text-center font-pixel text-[11px] uppercase tracking-[0.2em] text-mist-d">En attente de l’hôte…</p>
      )}
      {!canStart && <p className="text-center font-sans text-sm text-mist-d">Il faut au moins 4 joueurs pour commencer.</p>}
    </Screen>
  )
}