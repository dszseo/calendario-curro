import { render } from 'preact'
import './styles/base.css'
import { Router } from './router'
import { Shell } from './app'
import { Home } from './routes/Home'
import { Settings } from './routes/Settings'
import { Nomina } from './routes/Nomina'
import { BolsaAnual } from './routes/BolsaAnual'
import { DiasAnio } from './routes/DiasAnio'
import { requestPersistentStorage } from './lib/persist'
import { regenerarTodo } from './db/days'

requestPersistentStorage()
// Recalcula las entradas automáticas por si el cuadrante cambió estando cerrada.
regenerarTodo().catch(() => {})

const routes = [
  { pattern: '/', component: Home },
  { pattern: '/nomina', component: Nomina },
  { pattern: '/bolsa-anio', component: BolsaAnual },
  { pattern: '/dias-anio', component: DiasAnio },
  { pattern: '/ajustes', component: Settings },
]

function App() {
  return (
    <Shell>
      <Router routes={routes} fallback={Home} />
    </Shell>
  )
}

render(<App />, document.getElementById('app')!)
