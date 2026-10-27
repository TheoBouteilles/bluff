import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Screen, inputClass } from '../components/ui'
import { createRoom, errorMessage, saveLastRoom } from '../lib/api'

export default function CreateRoom() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [debug, setDebug] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await createRoom(nickname.trim(), debug)
      saveLastRoom(r.code)
      navigate(`/salon/${r.code}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Link to="/" className="text-slate-400 hover:text-white">← Retour</Link>
      <h1 className="text-3xl font-bold">Créer une partie</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          className={inputClass}
          placeholder="Ton pseudo"
          maxLength={20}
          autoFocus
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <label className="flex items-center gap-3 text-slate-300">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} className="h-5 w-5" />
          Mode debug (bots pour tester seul)
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <Button type="submit" disabled={busy || nickname.trim().length === 0}>
          {busy ? 'Création…' : 'Créer le salon'}
        </Button>
      </form>
    </Screen>
  )
}