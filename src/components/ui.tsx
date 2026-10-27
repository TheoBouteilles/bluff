import type { ButtonHTMLAttributes, ReactNode } from 'react'

const base = 'rounded-xl px-4 py-3 font-semibold text-center disabled:opacity-40 disabled:cursor-not-allowed'
export const styles = {
  primary: `${base} bg-violet-600 hover:bg-violet-500`,
  secondary: `${base} bg-slate-800 hover:bg-slate-700`,
  ghost: `${base} text-slate-400 hover:text-white`,
}
export const inputClass =
  'w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-lg outline-none focus:border-violet-500'

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-950 text-white flex flex-col items-center px-5 py-8">
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