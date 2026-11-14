import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import { Avatar } from '../components/Px'
import SoundButton from '../components/SoundOptions'
import { Button, Label, Note, Screen, TitleBar, inputClass, styles } from '../components/ui'
import { ACCESSORIES, AVATARS, TUNICS } from '../data/avatars'
import { clearMergeNotice, reloadProfile, updateProfile, useProfile } from '../hooks/useProfile'
import { accountError, sendEmailCode, signInWithGoogle, signOut, verifyEmailCode } from '../lib/account'
import { errorMessage } from '../lib/api'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-frame p-4">
      <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wider text-paper">{title}</h2>
      {children}
    </section>
  )
}

const pick = (on: boolean) =>
  `flex flex-col items-center gap-1 border-2 p-1.5 ${on ? 'border-ink bg-paper text-ink' : 'border-night-3 bg-night text-mist hover:border-gold'}`

export default function Profile() {
  const { loaded, profile, account, merged } = useProfile()

  // Brouillon local du profil, enregistré d'un clic
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [tunic, setTunic] = useState(0)
  const [acc, setAcc] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setNickname(profile.nickname ?? '')
    setAvatar(profile.avatar ?? 0)
    setTunic(profile.look?.t ?? 0)
    setAcc(profile.look?.a ?? 0)
  }, [profile])

  const dirty = !!profile && (
    nickname.trim() !== (profile.nickname ?? '') || avatar !== (profile.avatar ?? 0) ||
    tunic !== (profile.look?.t ?? 0) || acc !== (profile.look?.a ?? 0))

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateProfile({ nickname: nickname.trim() || null, avatar, look: { t: tunic, a: acc } })
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Connexion
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  async function askCode(e: FormEvent) {
    e.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      await sendEmailCode(email.trim())
      setCodeSent(true)
    } catch (err) {
      setAuthError(accountError(err))
    } finally {
      setAuthBusy(false)
    }
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      await verifyEmailCode(email.trim(), code)
      setCodeSent(false); setCode('')
      await reloadProfile()
    } catch (err) {
      setAuthError(accountError(err))
    } finally {
      setAuthBusy(false)
    }
  }

  async function google() {
    setAuthBusy(true); setAuthError('')
    try {
      await signInWithGoogle() // redirection vers Google
    } catch (err) {
      setAuthError(accountError(err))
      setAuthBusy(false)
    }
  }

  async function logout() {
    if (!window.confirm('Te déconnecter ? Tu redeviens un invité sur cet appareil ; tes stats restent sur ton compte.')) return
    setAuthBusy(true)
    try { await signOut() } finally { setAuthBusy(false) }
  }

  return (
    <Screen>
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Profil" left={<BackLink to="/" />} />
      </div>

      {!loaded ? (
        <p className="font-pixel text-[11px] uppercase tracking-widest text-mist-d">Chargement…</p>
      ) : (
        <>
          {merged && (
            <Note tone="ok">
              Connecté ! Tes données d’invité ont été rapatriées sur ton compte
              {merged.games ? ` (${merged.games} partie${merged.games > 1 ? 's' : ''})` : ''}.{' '}
              <button type="button" onClick={clearMergeNotice} className="underline">OK</button>
            </Note>
          )}

          <Section title="Mon compte">
            {account.guest ? (
              <div className="flex flex-col gap-3">
                <p className="font-sans text-sm text-mist">
                  Tu joues en <strong className="text-paper">invité</strong> : ton profil et tes statistiques sont liés à cet appareil.
                  Connecte-toi pour les garder et les retrouver partout (et reprendre ta place si tu changes de téléphone).
                </p>
                <Button type="button" variant="secondary" onClick={google} disabled={authBusy}>Continuer avec Google</Button>
                <div className="flex items-center gap-2 font-pixel text-[10px] uppercase tracking-widest text-mist-d">
                  <span className="h-0.5 flex-1 bg-night-3" />ou par e-mail<span className="h-0.5 flex-1 bg-night-3" />
                </div>
                {!codeSent ? (
                  <form onSubmit={askCode} className="flex flex-col gap-2">
                    <input className={inputClass} type="email" inputMode="email" autoComplete="email" placeholder="ton@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Button type="submit" disabled={authBusy || !email.includes('@')}>Recevoir un code</Button>
                  </form>
                ) : (
                  <form onSubmit={checkCode} className="flex flex-col gap-2">
                    <p className="font-sans text-sm text-mist">Code envoyé à <strong className="text-paper">{email}</strong>. Saisis-le ici, ou clique sur le lien reçu.</p>
                    <input className={`${inputClass} text-center font-display text-3xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <Button type="submit" disabled={authBusy || code.length < 6}>Valider</Button>
                    <button type="button" onClick={() => { setCodeSent(false); setCode('') }} className={styles.ghost}>Changer d’adresse</button>
                  </form>
                )}
                {authError && <Note tone="danger">{authError}</Note>}
                <p className="font-sans text-[11px] text-mist-d">Pas de mot de passe. Première connexion = création du compte. Ton adresse sert uniquement à te connecter.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-sans text-sm text-mist">
                  Connecté {account.provider === 'google' ? 'avec Google' : 'par e-mail'}
                  {account.email && <> : <strong className="text-paper">{account.email}</strong></>}.
                  Ton profil, tes préférences et tes statistiques te suivent sur tous tes appareils.
                </p>
                <button type="button" onClick={logout} disabled={authBusy} className={styles.ghost}>Se déconnecter</button>
              </div>
            )}
          </Section>

          <Section title="Pseudo">
            <input className={inputClass} maxLength={20} placeholder="Ex. Marcel" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <p className="mt-1 font-sans text-[11px] text-mist-d">Proposé automatiquement quand tu crées ou rejoins un salon.</p>
          </Section>

          <Section title="Avatar">
            <div className="mb-3 flex items-end justify-center gap-6">
              <Avatar index={avatar} look={{ t: tunic, a: acc }} kind="body" scale={5} />
              <Avatar index={avatar} look={{ t: tunic, a: acc }} scale={4} ring />
            </div>

            <Label className="mb-2">Personnage</Label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a, i) => (
                <button key={a.id} type="button" onClick={() => setAvatar(i)} className={pick(avatar === i)} aria-label={a.name}>
                  <Avatar index={i} look={{ a: acc }} scale={2} />
                  <span className="font-pixel text-[9px] uppercase">{a.name}</span>
                </button>
              ))}
            </div>

            <Label className="mt-4 mb-2">Tenue</Label>
            <div className="grid grid-cols-4 gap-2">
              {TUNICS.map((t, i) => (
                <button key={t.name} type="button" onClick={() => setTunic(i)} className={pick(tunic === i)}>
                  <span className="block h-5 w-8 border-2 border-ink" style={{ background: t.color ?? AVATARS[avatar].color }} />
                  <span className="font-pixel text-[9px] uppercase">{t.name}</span>
                </button>
              ))}
            </div>

            <Label className="mt-4 mb-2">Accessoire</Label>
            <div className="grid grid-cols-4 gap-2">
              {ACCESSORIES.map((name, i) => (
                <button key={name} type="button" onClick={() => setAcc(i)} className={pick(acc === i)}>
                  <Avatar index={avatar} look={{ a: i }} scale={2} />
                  <span className="font-pixel text-[9px] uppercase leading-tight">{name}</span>
                </button>
              ))}
            </div>
          </Section>

          {error && <Note tone="danger">{error}</Note>}
          {saved && !dirty && <Note tone="ok">Profil enregistré. Il s’appliquera dans tes prochains salons.</Note>}
          <Button type="button" onClick={save} disabled={saving || !dirty}>{dirty ? 'Enregistrer mon profil' : 'Profil à jour'}</Button>

          <Section title="Préférences">
            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-sm text-mist">Musique, bruitages et vibrations{account.guest ? '' : ' (synchronisés avec ton compte)'}.</p>
              <SoundButton variant="link" />
            </div>
            <Link to="/stats" className={`${styles.ghost} mt-2 w-full`}>Mes statistiques</Link>
          </Section>
        </>
      )}
    </Screen>
  )
}
