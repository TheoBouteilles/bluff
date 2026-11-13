import { useNavigate } from 'react-router-dom'

// Bouton « ◂ RETOUR » façon barre de titre
export default function BackLink({ to, label = 'Retour', onClick }: { to?: string; label?: string; onClick?: () => void }) {
  const navigate = useNavigate()
  const go = () => {
    if (onClick) return onClick()
    if (to) return navigate(to)
    return window.history.length > 1 ? navigate(-1) : navigate('/')
  }
  return (
    <button type="button" onClick={go} className="border-2 border-night-3 bg-night px-3 py-2 font-pixel text-[11px] uppercase tracking-wider text-mist hover:text-paper">
      ◂ {label}
    </button>
  )
}
