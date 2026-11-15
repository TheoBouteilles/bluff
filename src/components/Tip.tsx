import type { ReactNode } from 'react'
import { markTip, useTips } from '../hooks/useTips'

// Astuce contextuelle affichée une seule fois (« Compris » la range définitivement sur cet appareil)
export default function Tip({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { isSeen } = useTips()
  if (isSeen(id)) return null
  return (
    <aside className="animate-pop border-2 border-gold bg-gold/10 p-3" role="note">
      <p className="font-pixel text-[11px] uppercase tracking-[0.2em] text-gold">💡 {title}</p>
      <div className="mt-1 font-sans text-sm text-paper">{children}</div>
      <button
        type="button"
        onClick={() => markTip(id)}
        className="mt-2 font-pixel text-[11px] uppercase tracking-wide text-gold underline decoration-2 underline-offset-4 hover:text-paper"
      >
        Compris
      </button>
    </aside>
  )
}
