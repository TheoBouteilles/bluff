import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import Lobby from './pages/Lobby'
import RolesList from './pages/RolesList'
import GameStub from './pages/GameStub'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/creer" element={<CreateRoom />} />
        <Route path="/rejoindre/:code?" element={<JoinRoom />} />
        <Route path="/salon/:code" element={<Lobby />} />
        <Route path="/partie/:code" element={<GameStub />} />
        <Route path="/roles" element={<RolesList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}