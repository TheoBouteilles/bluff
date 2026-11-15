import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import { useProfileSync } from './hooks/useProfile'
import type { ComponentType } from 'react'

// Page chargée à la demande. Si une nouvelle version a été mise en ligne pendant que l'onglet était ouvert,
// l'ancien fichier n'existe plus : on recharge une fois la page pour récupérer la nouvelle version.
function page(load: () => Promise<{ default: ComponentType }>) {
  return lazy(() => load().then((m) => {
    sessionStorage.removeItem('bluff:reloaded')
    return m
  }).catch((e) => {
    if (!sessionStorage.getItem('bluff:reloaded')) {
      sessionStorage.setItem('bluff:reloaded', '1')
      window.location.reload()
      return new Promise<never>(() => {})
    }
    throw e
  }))
}
const CreateRoom = page(() => import('./pages/CreateRoom'))
const JoinRoom = page(() => import('./pages/JoinRoom'))
const Lobby = page(() => import('./pages/Lobby'))
const Rules = page(() => import('./pages/Rules'))
const Demo = page(() => import('./pages/Demo'))
const RolesList = page(() => import('./pages/RolesList'))
const Game = page(() => import('./pages/Game'))
const Stats = page(() => import('./pages/Stats'))
const Balance = page(() => import('./pages/Balance'))
const Profile = page(() => import('./pages/Profile'))
const Privacy = page(() => import('./pages/Privacy'))
const Tutorial = page(() => import('./pages/Tutorial'))

export default function App() {
  useProfileSync()
  return (
    <BrowserRouter>
      {/* Pages chargées à la demande : l'accueil s'affiche vite, le reste arrive en tâche de fond */}
      <Suspense fallback={<p className="mt-24 text-center font-pixel text-[11px] uppercase tracking-widest text-mist-d">Chargement…</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/creer" element={<CreateRoom />} />
        <Route path="/rejoindre/:code?" element={<JoinRoom />} />
        <Route path="/salon/:code" element={<Lobby />} />
        <Route path="/partie/:code" element={<Game />} />
        {import.meta.env.DEV && <Route path="/demo" element={<Demo />} />}
        <Route path="/regles" element={<Rules />} />
        <Route path="/roles" element={<RolesList />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/equilibrage" element={<Balance />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/tutoriel" element={<Tutorial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}