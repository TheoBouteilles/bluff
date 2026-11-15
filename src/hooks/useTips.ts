import { useSyncExternalStore } from 'react'

// Astuces vues (une seule fois par appareil) et tutoriel déjà ouvert : stockage local du navigateur
const KEY = 'bluff:tips'
const TUTO_KEY = 'bluff:tutoSeen'

function load(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

let seen = load()
let tutoSeen = (() => { try { return localStorage.getItem(TUTO_KEY) === '1' } catch { return false } })()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function markTip(id: string) {
  if (seen.includes(id)) return
  seen = [...seen, id]
  try { localStorage.setItem(KEY, JSON.stringify(seen)) } catch { /* stockage indisponible */ }
  emit()
}

export function resetTips() {
  seen = []
  try { localStorage.removeItem(KEY) } catch { /* stockage indisponible */ }
  emit()
}

export function markTutorialSeen() {
  tutoSeen = true
  try { localStorage.setItem(TUTO_KEY, '1') } catch { /* stockage indisponible */ }
  emit()
}

export function useTips() {
  const snap = useSyncExternalStore(subscribe, () => `${tutoSeen}|${seen.join(',')}`)
  return { isSeen: (id: string) => snap.split('|')[1].split(',').includes(id), tutorialSeen: snap.startsWith('true') }
}
