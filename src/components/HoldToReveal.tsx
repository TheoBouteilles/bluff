import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function HoldToReveal({ children }: { children: ReactNode }) {
  const [holding, setHolding] = useState(false)

  // Masque aussi si l'app passe en arrière-plan
  useEffect(() => {
    const hide = () => setHolding(false)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') hide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', hide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', hide)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {holding ? (
        children
      ) : (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-800/40 bg-stone-900/80 text-stone-500">
          <EyeOff size={56} strokeWidth={1.25} />
          <span className="mt-3 font-display">Ton rôle est caché</span>
        </div>
      )}
      <button
        type="button"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
        className="flex select-none touch-none items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-6 text-lg font-bold text-stone-950 shadow-lg shadow-amber-900/30 active:from-amber-400 active:to-amber-500"
      >
        <Eye size={22} />
        {holding ? 'Relâche pour masquer' : 'Maintiens pour révéler ton rôle'}
      </button>
    </div>
  )
}