import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Px } from './Px'

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
        <div className="px-frame flex h-72 flex-col items-center justify-center gap-3 text-mist-d">
          <Px name="lock" scale={4} className="animate-float" />
          <span className="font-pixel text-[11px] uppercase tracking-[0.2em]">Ton rôle est caché</span>
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
        className={`px-frame px-press flex select-none touch-none items-center justify-center gap-2 px-4 py-5 font-pixel text-[13px] uppercase tracking-wide ${holding ? '!bg-gold text-ink' : '!bg-paper text-ink'}`}
      >
        {holding ? '● Relâche pour masquer' : '○ Maintiens pour révéler ton rôle'}
      </button>
    </div>
  )
}
