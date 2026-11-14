import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ensureSession, resetSessionCache } from './auth'
import { claimMergeTicket, createMergeTicket } from './api'

/*
 * Comptes optionnels (e-mail ou Google).
 * Tant qu'on n'est pas connecté, on joue en invité (session anonyme Supabase).
 * Connexion : l'invité crée d'abord un ticket de fusion (gardé dans ce navigateur), puis se connecte ;
 * au retour, le ticket rapatrie ses statistiques, son profil et ses places en salon sur le compte.
 * Le même parcours sert à créer un compte (première connexion) et à se reconnecter sur un autre appareil.
 */

const TICKET_KEY = 'bluff:mergeTicket'

export type Account = { guest: boolean; email: string | null; provider: 'email' | 'google' | null }

export function describe(user: User | null): Account {
  if (!user || user.is_anonymous) return { guest: true, email: null, provider: null }
  const google = user.identities?.some((i) => i.provider === 'google') || user.app_metadata?.provider === 'google'
  return { guest: false, email: user.email ?? null, provider: google ? 'google' : 'email' }
}

export async function currentAccount(): Promise<Account> {
  const { data } = await supabase.auth.getSession()
  return describe(data.session?.user ?? null)
}

// Avant de quitter la session invité : ticket secret à usage unique (30 min)
async function prepareMerge() {
  try {
    await ensureSession()
    const ticket = await createMergeTicket()
    if (ticket) localStorage.setItem(TICKET_KEY, ticket)
  } catch { /* pas bloquant : on se connecte quand même, sans rapatrier */ }
}

// Après la connexion : rapatrie les données de l'invité si un ticket attend dans ce navigateur
export async function finishMerge(): Promise<{ merged: boolean; games?: number; seats?: number } | null> {
  let ticket: string | null = null
  try { ticket = localStorage.getItem(TICKET_KEY) } catch { return null }
  if (!ticket) return null
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.is_anonymous) return null
  try {
    return await claimMergeTicket(ticket)
  } finally {
    try { localStorage.removeItem(TICKET_KEY) } catch { /* stockage indisponible */ }
  }
}

const redirectTo = () => `${window.location.origin}/profil`

// E-mail, étape 1 : envoi d'un code à 6 chiffres (et d'un lien de connexion)
export async function sendEmailCode(email: string) {
  await prepareMerge()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } })
  if (error) throw error
}

// E-mail, étape 2 : saisie du code reçu
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
  if (error) throw error
  resetSessionCache()
  return finishMerge()
}

// Google : redirection vers Google, retour sur /profil (la fusion se termine au retour)
export async function signInWithGoogle() {
  await prepareMerge()
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  if (error) throw error
}

// Déconnexion : on redevient un nouvel invité (stats et profil restent sur le compte)
export async function signOut() {
  await supabase.auth.signOut()
  resetSessionCache()
  await ensureSession()
}

export function accountError(e: unknown): string {
  const msg = ((e as { message?: string })?.message ?? '').toLowerCase()
  if (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid'))) return 'Code incorrect ou expiré. Redemande un code.'
  if (msg.includes('rate') || msg.includes('security purposes')) return 'Trop de demandes. Patiente une minute avant de redemander un code.'
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) return 'La connexion Google n’est pas encore activée sur le serveur.'
  if (msg.includes('email') && msg.includes('invalid')) return 'Adresse e-mail invalide.'
  if (msg.includes('signups not allowed')) return 'Les inscriptions sont fermées pour le moment.'
  return 'La connexion a échoué. Réessaie.'
}
