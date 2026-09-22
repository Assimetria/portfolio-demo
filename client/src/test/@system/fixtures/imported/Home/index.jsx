// Reference imported page — mirrors exactly what Orkosi's website cloner emits at
// client/src/app/pages/@custom/imported/<PascalName>/index.jsx
// (docs/INFORMATIONAL-SPEC.md §6). Lives under src/test so the template ships
// no dead route; the contract is exercised by imported-page-contract.test.jsx.
import { ImportedRoot } from '@/app/components/@system/site/ImportedRoot'
// Real emit: import '../../../../styles/@custom/imported/site.css'
import '../site.css'

export default function Home() {
  return (
    <ImportedRoot>
      <main className="hero">
        <h1>Casa do Norte</h1>
        <p className="lead">Cozinha portuguesa desde 1985.</p>
        <img src="/imported/assets/hero.jpg" alt="Dining room" width="1200" height="600" />
        <a className="cta" href="/menu">Ver menu</a>
      </main>
    </ImportedRoot>
  )
}
