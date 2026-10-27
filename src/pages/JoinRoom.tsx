import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Screen, inputClass } from '../components/ui'
import { errorMessage, joinRoom, saveLastRoom } from '../lib/api'

export default function JoinRoom() {
  const navigate = useNavigate()
  const params = useParams()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await joinRoom(code, nickname.trim())
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
      <h1 className="text-3xl font-bold">Rejoindre une partie</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          className={`${inputClass} text-center text-3xl tracking-[0.4em] uppercase`}
          placeholder="CODE"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <input
          className={inputClass}
          placeholder="Ton pseudo"
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {error && <p className="text-red-400">{error}</p>}
        <Button type="submit" disabled={busy || code.length !== 4 || nickname.trim().length === 0}>
          {busy ? 'Connexion…' : 'Rejoindre'}
        </Button>
      </form>
    </Screen>
  )
}