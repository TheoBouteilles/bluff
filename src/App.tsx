import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [status, setStatus] = useState('Connexion…')

  useEffect(() => {
    async function connect() {
      const { data: s } = await supabase.auth.getSession()
      if (s.session) {
        setStatus(`Connecté ✅ (${s.session.user.id.slice(0, 8)})`)
        return
      }
      const { data, error } = await supabase.auth.signInAnonymously()
      setStatus(
        error
          ? `Erreur : ${error.message}`
          : `Connecté ✅ (${data.user?.id.slice(0, 8)})`
      )
    }
    connect()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
      <h1 className="text-4xl font-bold">Bluff 🎭</h1>
      <p className="text-slate-400">{status}</p>
    </div>
  )
}