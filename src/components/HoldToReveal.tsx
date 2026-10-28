import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

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
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 text-slate-500">
          <span className="text-6xl">🙈</span>
          <span className="mt-3">Ton rôle est caché</span>
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
        className="select-none touch-none rounded-2xl bg-violet-600 px-4 py-6 text-lg font-semibold active:bg-violet-500"
      >
        {holding ? 'Relâche pour masquer' : 'Maintiens pour révéler ton rôle'}
      </button>
    </div>
  )
}