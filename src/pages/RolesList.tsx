import { useNavigate } from 'react-router-dom'
import { Screen } from '../components/ui'
import { ROLES, TEAMS } from '../data/roles'

export default function RolesList() {
  const navigate = useNavigate()
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <Screen>
      <button onClick={back} className="self-start text-stone-400 hover:text-white">← Retour</button>
      <h1 className="text-3xl font-bold">Les rôles</h1>
      {TEAMS.map((t) => (
        <section key={t.id} className="flex flex-col gap-3">
          <h2 className={`text-lg font-bold ${t.text}`}>{t.label}</h2>
          {ROLES.filter((r) => r.team === t.id).map((r) => (
            <article key={r.id} className="rounded-2xl border border-stone-800 bg-stone-900 p-4">
              <h3 className="text-lg font-semibold">{r.name}</h3>
              <p className="text-sm text-stone-400">{r.description}</p>
              <p className="mt-2 text-sm"><span className="text-stone-500">Pouvoir : </span>{r.power}</p>
              <p className="mt-1 text-sm"><span className="text-stone-500">Victoire : </span>{r.victory}</p>
            </article>
          ))}
        </section>
      ))}
    </Screen>
  )
}