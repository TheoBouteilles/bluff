import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Coins } from 'lucide-react'

const base =
  'rounded-xl px-4 py-3 font-semibold text-center transition disabled:opacity-40 disabled:cursor-not-allowed'

export const styles = {
  primary: `${base} bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-lg shadow-amber-900/30 hover:from-amber-400 hover:to-amber-500`,
  secondary: `${base} border border-amber-800/40 bg-stone-900/80 text-amber-100 hover:border-amber-600/60`,
  ghost: `${base} text-stone-400 hover:text-amber-100`,
}

export const inputClass =
  'w-full rounded-xl border border-amber-800/40 bg-stone-900/80 px-4 py-3 text-lg text-amber-50 placeholder:text-stone-500 outline-none focus:border-amber-500'

export const panelClass = 'rounded-xl border border-amber-800/40 bg-stone-900/80 backdrop-blur-md'

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-md flex flex-col gap-4">{children}</div>
    </main>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof styles }) {
  return <button {...props} className={`${styles[variant]} ${className}`} />
}

// Jeton d'or ; la clé relance l'animation de brillance à chaque changement de valeur
export function TokenBadge({ count }: { count: number }) {
  return (
    <span
      key={count}
      className="inline-flex animate-shine items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-1 font-bold text-stone-950"
    >
      <Coins size={16} />
      {count}
    </span>
  )
}