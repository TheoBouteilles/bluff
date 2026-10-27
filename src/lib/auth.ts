import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

let pending: Promise<User> | null = null

// Garantit une session anonyme (une seule création, même si appelée plusieurs fois)
export function ensureSession(): Promise<User> {
  if (!pending) {
    pending = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return data.session.user
      const { data: d, error } = await supabase.auth.signInAnonymously()
      if (error || !d.user) throw error ?? new Error('not_authenticated')
      return d.user
    })().catch((e) => {
      pending = null
      throw e
    })
  }
  return pending
}