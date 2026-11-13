import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BackLink from '../components/BackLink'
import { Button, Label, Note, Screen, TitleBar, inputClass } from '../components/ui'
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
      <TitleBar title="Créer une partie" left={<BackLink to="/" />} />
      <form onSubmit={submit} className="px-frame flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label>Ton pseudo</Label>
          <input className={inputClass} placeholder="Ex. Marcel" maxLength={20} autoFocus value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 font-sans text-sm text-mist">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} className="h-5 w-5 accent-gold" />
          Mode debug (bots pour tester seul)
        </label>
        {error && <Note tone="danger">{error}</Note>}
        <Button type="submit" disabled={busy || nickname.trim().length === 0}>
          {busy ? 'Création…' : 'Créer le salon'}
        </Button>
      </form>
    </Screen>
  )
}
