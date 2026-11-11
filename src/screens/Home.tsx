import { useMemo } from 'react'
import { TxRow } from '../components/TxRow'
import { Icon } from '../components/Icon'
import type { Category, Tx } from '../db'
import { daysSince } from '../lib/dates'
import { getLastBackup } from '../lib/lastBackup'
import { formatCents } from '../lib/money'
import { breakdown } from '../lib/reports'
import { nameMap, newestFirst } from '../lib/tx'

interface Props {
  txs: Tx[]
  categories: Category[]
  totalCount: number
  onOpenTx: (tx: Tx) => void
  onNew: () => void
  onGoSettings: () => void
}

export function Home({ txs, categories, totalCount, onOpenTx, onNew, onGoSettings }: Props) {
  const names = useMemo(() => nameMap(categories), [categories])

  const { income, expense } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const t of txs) {
      if (t.kind === 'income') inc += t.cents
      else exp += t.cents
    }
    return { income: inc, expense: exp }
  }, [txs])
  // Mesma regra do relatório: as 6 maiores categorias e, se houver mais, uma linha "Demais categorias".
  const byCategory = useMemo(() => breakdown(txs, 'expense', names), [txs, names])

  const sinceBackup = daysSince(getLastBackup())
  const needsBackup = totalCount > 0 && (sinceBackup === null || sinceBackup >= 30)
  const recent = useMemo(() => [...txs].sort(newestFirst).slice(0, 5), [txs])

  return (
    <>
      <section className="anim-rise rounded-3xl bg-hero p-5 text-on-hero shadow-card">
        <p className="text-sm opacity-90">Saldo do mês</p>
        <p className="num mt-1 text-[clamp(1.75rem,9vw,2.25rem)] font-bold break-words">{formatCents(income - expense)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/15 p-3">
            <p className="flex items-center gap-1 text-xs opacity-90">
              <Icon name="up" className="size-4" /> Receitas
            </p>
            <p className="num mt-1 text-[clamp(0.875rem,4.2vw,1rem)] font-semibold break-words">+ {formatCents(income)}</p>
          </div>
          <div className="rounded-2xl bg-black/15 p-3">
            <p className="flex items-center gap-1 text-xs opacity-90">
              <Icon name="down" className="size-4" /> Despesas
            </p>
            <p className="num mt-1 text-[clamp(0.875rem,4.2vw,1rem)] font-semibold break-words">− {formatCents(expense)}</p>
          </div>
        </div>
      </section>

      {needsBackup && (
        <button onClick={onGoSettings} className="anim-rise flex w-full items-center gap-3 rounded-2xl bg-expense-soft p-4 text-left text-expense">
          <Icon name="share" className="size-6 shrink-0" />
          <span className="text-sm">
            <b className="block">{sinceBackup === null ? 'Você ainda não fez backup' : `Faz ${sinceBackup} dias do último backup`}</b>
            Seus dados só existem neste aparelho. Toque para salvar uma cópia.
          </span>
        </button>
      )}

      {txs.length === 0 ? (
        <section className="anim-rise rounded-3xl bg-surface p-6 text-center shadow-card">
          <p className="font-semibold">Nenhum lançamento neste mês</p>
          <p className="mt-1 text-sm text-muted">Registre sua primeira receita ou despesa.</p>
          <button onClick={onNew} className="mt-4 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary active:scale-95">
            Novo lançamento
          </button>
        </section>
      ) : (
        <>
          {byCategory.length > 0 && (
            <section className="anim-rise rounded-3xl bg-surface p-5 shadow-card" style={{ animationDelay: '60ms' }}>
              <h2 className="mb-4 font-semibold">Para onde foi o dinheiro</h2>
              <ul className="space-y-3">
                {byCategory.map((row) => (
                  <li key={row.id ?? 'others'}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="num text-muted">{formatCents(row.cents)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-expense transition-[width] duration-500" style={{ width: `${row.share * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="anim-rise rounded-3xl bg-surface p-2 shadow-card" style={{ animationDelay: '120ms' }}>
            <h2 className="px-3 pt-3 pb-1 font-semibold">Últimos lançamentos</h2>
            <ul>
              {recent.map((t) => (
                <TxRow key={t.id} tx={t} categoryName={names.get(t.categoryId) ?? 'Sem categoria'} onOpen={onOpenTx} />
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
