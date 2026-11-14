import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'
import { getMyProfile, saveMyProfile } from '../lib/api'
import type { Profile } from '../lib/api'
import { currentAccount, finishMerge } from '../lib/account'
import type { Account } from '../lib/account'
import { getAudioSettings, setAudioSettings, subscribeAudio } from '../lib/audio'
import type { AudioSettings } from '../lib/audio'

// Profil et compte partagés par toute l'app (chargés une fois, rechargés à chaque connexion / déconnexion)
type State = { loaded: boolean; profile: Profile | null; account: Account; merged: { games?: number; seats?: number } | null }

let state: State = { loaded: false, profile: null, account: { guest: true, email: null, provider: null }, merged: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

let applyingPrefs = false

export async function reloadProfile() {
  try {
    await ensureSession()
    const merge = await finishMerge() // retour de Google, ou connexion par e-mail faite ailleurs
    const [profile, account] = await Promise.all([getMyProfile(), currentAccount()])
    set({ loaded: true, profile, account, merged: merge?.merged ? merge : state.merged })
    // Préférences de son : celles du profil s'appliquent à cet appareil ; sinon on les y enregistre
    const audio = profile.prefs?.audio as Partial<AudioSettings> | undefined
    if (audio && typeof audio === 'object') {
      applyingPrefs = true
      setAudioSettings(audio)
      applyingPrefs = false
    } else {
      saveMyProfile({ prefs: { ...profile.prefs, audio: getAudioSettings() } }).catch(() => undefined)
    }
  } catch {
    set({ loaded: true })
  }
}

export async function updateProfile(patch: { nickname?: string | null; avatar?: number | null; look?: { t?: number; a?: number } | null }) {
  const profile = await saveMyProfile(patch)
  set({ profile })
  return profile
}

export const clearMergeNotice = () => set({ merged: null })

export function useProfile() {
  return useSyncExternalStore(subscribe, () => state)
}

// À monter une fois à la racine : chargement, suivi des connexions, sauvegarde des préférences de son
export function useProfileSync() {
  useEffect(() => {
    reloadProfile()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') reloadProfile()
    })
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubAudio = subscribeAudio(() => {
      if (applyingPrefs || !state.profile) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const prefs = { ...(state.profile?.prefs ?? {}), audio: getAudioSettings() }
        saveMyProfile({ prefs }).then((profile) => set({ profile })).catch(() => undefined)
      }, 1000)
    })
    return () => {
      data.subscription.unsubscribe()
      unsubAudio()
      if (timer) clearTimeout(timer)
    }
  }, [])
}
