import { useEffect, useSyncExternalStore } from 'react'

// Application installable : service worker, invitation à l'installation, écran toujours allumé en partie

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Déjà lancée depuis l'écran d'accueil (application installée) ? */
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone / iPad : pas d'invitation automatique, il faut passer par « Partager > Sur l'écran d'accueil » */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // on garde l'invitation pour notre propre bouton
    deferred = e as InstallPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
  // Service worker en production seulement (en développement il gênerait le rechargement à chaud)
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    })
  }
}

/** Invitation à installer : `canInstall` (Android, Chrome, Edge) ou consigne manuelle sur iPhone */
export function useInstall() {
  const can = useSyncExternalStore(subscribe, () => !!deferred)
  return {
    canInstall: can,
    iosHint: !can && isIos() && !isStandalone(),
    installed: isStandalone(),
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => undefined)
      deferred = null
      emit()
    },
  }
}

/** Garde l'écran allumé tant que `active` (partie en cours) ; relancé au retour sur l'onglet */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = async () => {
      if (document.visibilityState !== 'visible' || stopped) return
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch { /* refusé (batterie faible, navigateur) : tant pis */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => undefined)
    }
  }, [active])
}
