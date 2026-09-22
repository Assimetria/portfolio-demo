// Reference imported page #2 — see Home/index.jsx.
import { ImportedRoot } from '@/app/components/@system/site/ImportedRoot'
import '../site.css'

export default function Menu() {
  return (
    <ImportedRoot>
      <main className="menu">
        <h1>Menu</h1>
        <ul>
          <li>Bacalhau à Brás</li>
          <li>Arroz de pato</li>
        </ul>
      </main>
    </ImportedRoot>
  )
}
