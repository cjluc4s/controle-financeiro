import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { TxSheet } from './components/TxSheet'
import { db, type Tx } from './db'
import { useTheme } from './hooks/useTheme'
import { monthRange, startOfMonth, toISODate } from './lib/dates'
import { formatMonth } from './lib/money'
import { Home } from './screens/Home'
import { Reports } from './screens/Reports'
import { Settings } from './screens/Settings'
import { Statement } from './screens/Statement'

type Tab = 'home' | 'list' | 'reports' | 'settings'

type Sheet = { mode: 'closed' } | { mode: 'new'; date: string } | { mode: 'edit'; tx: Tx }

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [sheet, setSheet] = useState<Sheet>({ mode: 'closed' })
  const [theme, setTheme] = useTheme()

  const [start, end] = monthRange(month)
  const txs = useLiveQuery(() => db.transactions.where('date').between(start, end, true, false).toArray(), [start, end])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const totalCount = useLiveQuery(() => db.transactions.count(), [])

  // Pede ao navegador para não apagar os dados quando faltar espaço (importante no Safari).
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const closeSheet = () => setSheet({ mode: 'closed' })

  // Data sugerida no novo lançamento: hoje, se estamos vendo o mês atual; senão, o dia 1 do mês visto.
  const openNew = () => {
    const today = new Date()
    const sameMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
    setSheet({ mode: 'new', date: toISODate(sameMonth ? today : month) })
  }

  const ready = txs && categories && accounts && totalCount !== undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <button onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="grid size-10 place-items-center rounded-full text-muted active:bg-line">
            <Icon name="left" />
          </button>
          <h1 className="min-w-28 text-center text-base font-semibold">{formatMonth(month)}</h1>
          <button onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="grid size-10 place-items-center rounded-full text-muted active:bg-line">
            <Icon name="right" />
          </button>
        </div>
        <span className="hidden whitespace-nowrap rounded-full bg-income-soft px-3 py-1 text-xs font-medium text-income min-[350px]:inline-block">Só neste aparelho</span>
      </header>

      <main className="flex-1 space-y-4 px-4 pt-2 pb-36">
        {ready && (
          <>
            {tab === 'home' && <Home txs={txs} categories={categories} totalCount={totalCount} onOpenTx={(tx) => setSheet({ mode: 'edit', tx })} onNew={openNew} onGoSettings={() => setTab('settings')} />}
            {tab === 'list' && <Statement txs={txs} categories={categories} onOpenTx={(tx) => setSheet({ mode: 'edit', tx })} />}
            {tab === 'reports' && <Reports month={month} txs={txs} categories={categories} />}
            {tab === 'settings' && <Settings theme={theme} onTheme={setTheme} />}
          </>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Navegação principal">
        <ul className="grid grid-cols-5 items-center px-2 py-1">
          <TabButton current={tab} id="home" label="Início" icon="home" onSelect={setTab} />
          <TabButton current={tab} id="list" label="Extrato" icon="list" onSelect={setTab} />
          <li className="flex justify-center">
            <button onClick={openNew} aria-label="Novo lançamento" className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-card transition-transform active:scale-90">
              <Icon name="plus" className="size-7" />
            </button>
          </li>
          <TabButton current={tab} id="reports" label="Relatórios" icon="chart" onSelect={setTab} />
          <TabButton current={tab} id="settings" label="Ajustes" icon="gear" onSelect={setTab} />
        </ul>
      </nav>

      {sheet.mode !== 'closed' && categories && accounts && (
        <TxSheet key={sheet.mode === 'edit' ? sheet.tx.id : 'new'} tx={sheet.mode === 'edit' ? sheet.tx : undefined} defaultDate={sheet.mode === 'new' ? sheet.date : sheet.tx.date} categories={categories} accounts={accounts} onClose={closeSheet} />
      )}
    </div>
  )
}

function TabButton({ current, id, label, icon, onSelect }: { current: Tab; id: Tab; label: string; icon: IconName; onSelect: (t: Tab) => void }) {
  const active = current === id
  return (
    <li>
      <button onClick={() => onSelect(id)} aria-current={active ? 'page' : undefined} className={`flex w-full flex-col items-center gap-0.5 rounded-2xl px-0.5 py-2 text-[10px] font-medium transition-colors min-[360px]:text-[11px] ${active ? 'text-primary' : 'text-muted'}`}>
        <Icon name={icon} className="size-6" />
        {label}
      </button>
    </li>
  )
}
