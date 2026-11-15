import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import Lobby from './pages/Lobby'
import Rules from './pages/Rules'
import Demo from './pages/Demo'
import RolesList from './pages/RolesList'
import Game from './pages/Game'
import Stats from './pages/Stats'
import Balance from './pages/Balance'
import Profile from './pages/Profile'
import Privacy from './pages/Privacy'
import Tutorial from './pages/Tutorial'
import { useProfileSync } from './hooks/useProfile'

export default function App() {
  useProfileSync()
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}