import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import { Avatar } from '../components/Px'
import { Link } from 'react-router-dom'
import { updateProfile, useProfile } from '../hooks/useProfile'
import { Button, Label, Note, Screen, TitleBar, inputClass } from '../components/ui'
import { errorMessage, joinRoom, saveLastRoom } from '../lib/api'

export default function JoinRoom() {
  const navigate = useNavigate()
  const params = useParams()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [nickname, setNickname] = useState('')
  const { profile } = useProfile()
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !profile) return
    prefilled.current = true
    if (profile.nickname) setNickname((n) => n || profile.nickname || '')
  }, [profile])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await joinRoom(code, nickname.trim())
      saveLastRoom(r.code)
      if (!profile?.nickname) updateProfile({ nickname: nickname.trim() }).catch(() => undefined)
      navigate(`/salon/${r.code}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TitleBar title="Rejoindre" left={<BackLink to="/" />} />
      <form onSubmit={submit} className="px-frame flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label>Code du salon</Label>
          <input
            className={`${inputClass} text-center font-display text-4xl font-bold uppercase tracking-[0.4em]`}
            placeholder="ABCD"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Ton pseudo</Label>
            <Link to="/profil" className="flex items-center gap-2 font-pixel text-[10px] uppercase tracking-wider text-sand underline decoration-2 underline-offset-4">
              {profile?.avatar != null && <Avatar index={profile.avatar} look={profile.look} scale={1} />} Mon avatar
            </Link>
          </div>
          <input className={inputClass} placeholder="Ex. Marcel" maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        {error && <Note tone="danger">{error}</Note>}
        <Button type="submit" disabled={busy || code.length !== 4 || nickname.trim().length === 0}>
          {busy ? 'Connexion…' : 'Rejoindre'}
        </Button>
      </form>
    </Screen>
  )
}
