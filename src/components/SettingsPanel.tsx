import { Minus, Plus } from 'lucide-react'
import { SETTING_GROUPS } from '../data/settings'
import type { SettingDef } from '../data/settings'
import { panelClass } from './ui'

type Props = {
  settings: Record<string, number>
  editable: boolean
  onChange: (key: string, value: number) => void
  onReset: () => void
}

const stepBtn =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-amber-800/40 bg-stone-950/70 text-amber-100 transition hover:border-amber-600/60 disabled:opacity-30 disabled:cursor-not-allowed'

function Row({ def, value, editable, onChange }: { def: SettingDef; value: number; editable: boolean; onChange: (v: number) => void }) {
  const step = def.step ?? 1
  const shown = def.format ? def.format(value) : `${value}${def.unit ?? ''}`
  const changed = value !== def.default
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={changed ? 'text-amber-200' : 'text-stone-200'}>{def.label}</p>
        {def.hint && <p className="text-xs text-stone-500">{def.hint}</p>}
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={stepBtn} disabled={value <= def.min} onClick={() => onChange(Math.max(def.min, value - step))} aria-label={`Diminuer ${def.label}`}>
            <Minus size={14} />
          </button>
          <span className="w-14 text-center font-semibold text-amber-300">{shown}</span>
          <button type="button" className={stepBtn} disabled={value >= def.max} onClick={() => onChange(Math.min(def.max, value + step))} aria-label={`Augmenter ${def.label}`}>
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <span className="shrink-0 font-semibold text-amber-300">{shown}</span>
      )}
    </li>
  )
}

export default function SettingsPanel({ settings, editable, onChange, onReset }: Props) {
  return (
    <details className={`${panelClass} p-4`} open={editable}>
      <summary className="cursor-pointer text-lg font-bold text-amber-100">
        Réglages de la partie {!editable && <span className="text-sm font-normal text-stone-400">(choisis par l’hôte)</span>}
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {SETTING_GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{g.title}</h3>
            <ul className="mt-1 divide-y divide-stone-800">
              {g.settings.map((def) => (
                <Row key={def.key} def={def} value={settings[def.key] ?? def.default} editable={editable} onChange={(v) => onChange(def.key, v)} />
              ))}
            </ul>
          </div>
        ))}
        {editable && (
          <button type="button" onClick={onReset} className="text-sm text-stone-400 underline hover:text-amber-100">
            Rétablir les valeurs par défaut
          </button>
        )}
      </div>
    </details>
  )
}
