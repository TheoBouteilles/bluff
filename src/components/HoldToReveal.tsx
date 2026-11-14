import { useEffect, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Px } from './Px'
import { playSfx } from '../lib/audio'

export default function HoldToReveal({ children }: { children: ReactNode }) {
  const [holding, setHolding] = useState(false)

  // Masque aussi si l'app passe en arrière-plan ou si le bouton est relâché n'importe où
  useEffect(() => {
    const hide = () => setHolding(false)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') hide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', hide)
    window.addEventListener('pointerup', hide)
    window.addEventListener('pointercancel', hide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', hide)
      window.removeEventListener('pointerup', hide)
      window.removeEventListener('pointercancel', hide)
    }
  }, [])

  // Sur ordinateur, la carte qui s'affiche décale le bouton sous la souris : on « capture » le pointeur
  // pour que le relâchement reste la seule façon de masquer (pas de pointerleave parasite).
  function start(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* navigateur ancien */ }
    setHolding(true)
    playSfx('reveal')
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onPointerDown={start}
        onLostPointerCapture={() => setHolding(false)}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setHolding(true) } }}
        onKeyUp={() => setHolding(false)}
        style={{ WebkitTouchCallout: 'none' }}
        className={`px-frame px-press flex select-none touch-none items-center justify-center gap-2 px-4 py-5 font-pixel text-[13px] uppercase tracking-wide outline-none focus-visible:[outline:3px_solid_var(--color-gold)] ${holding ? '!bg-gold text-ink' : '!bg-paper text-ink'}`}
      >
        {holding ? '● Relâche pour masquer' : '○ Maintiens pour révéler ton rôle'}
      </button>
      {holding ? (
        children
      ) : (
        <div className="px-frame flex h-72 flex-col items-center justify-center gap-3 text-mist-d">
          <Px name="lock" scale={4} className="animate-float" />
          <span className="font-pixel text-[11px] uppercase tracking-[0.2em]">Ton rôle est caché</span>
        </div>
      )}
    </div>
  )
}
