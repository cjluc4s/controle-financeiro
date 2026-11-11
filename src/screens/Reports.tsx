import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { db, type Category, type Kind, type Tx } from '../db'
import { formatDayMonth, monthRange, shortMonth, toISODate } from '../lib/dates'
import { formatCents, formatMonth } from '../lib/money'
import { breakdown, dailyAverage, formatCompact, largestExpense, lastMonths, niceScale, savingsRate, totalsByMonth } from '../lib/reports'

interface Props {
  /** Mês escolhido no cabeçalho. */
  month: Date
  /** Lançamentos desse mês. */
  txs: Tx[]
  categories: Category[]
}

const PLOT_HEIGHT = 160
const MIN_COLUMN = 30

export function Reports({ month, txs, categories }: Props) {
  const [range, setRange] = useState<6 | 12>(6)
  const [kind, setKind] = useState<Kind>('expense')
  const [now] = useState(() => new Date())

  const months = useMemo(() => lastMonths(month, range), [month, range])
  const from = toISODate(months[0])
  const to = monthRange(month)[1]
  const history = useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])

  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const totals = useMemo(() => totalsByMonth(history ?? [], months), [history, months])
  if (!history) return null

  const current = totals[totals.length - 1]
  const previous = totals[totals.length - 2]
  const rate = savingsRate(current.income, current.expense)
  const prevRate = savingsRate(previous.income, previous.expense)
  const avg = dailyAverage(current.expense, month, now)
  const prevAvg = dailyAverage(previous.expense, previous.month, now)
  const biggest = largestExpense(txs)
  const rows = breakdown(txs, kind, names)

  return (
    <div className="anim-fade space-y-4">
      {/* Um único lugar para os filtros, acima de tudo o que eles afetam. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Segmented
          label="Categorias"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesas' },
            { value: 'income', label: 'Receitas' },
          ]}
        />
        <Segmented
          label="Histórico"
          value={range}
          onChange={setRange}
          options={[
            { value: 6, label: '6 meses' },
            { value: 12, label: '12 meses' },
          ]}
        />
      </div>

      <section className="grid grid-cols-2 gap-3" aria-label={`Resumo de ${formatMonth(month)}`}>
        <Tile label="Taxa de poupança" value={rate === null ? '—' : percent(rate)} hint={rate === null ? 'Sem receitas no mês' : undefined}>
          {rate !== null && prevRate !== null && <Delta change={(rate - prevRate) * 100} unit=" p.p." goodWhenUp />}
        </Tile>
        <Tile label="Gasto médio por dia" value={avg > 0 ? formatCents(avg) : '—'}>
          {avg > 0 && prevAvg > 0 && <Delta change={((avg - prevAvg) / prevAvg) * 100} unit="%" goodWhenUp={false} />}
        </Tile>
        <div className="col-span-2">
          <Tile label="Maior despesa" value={biggest ? formatCents(biggest.cents) : '—'} hint={biggest ? `${biggest.note || names.get(biggest.categoryId) || 'Sem categoria'} · ${formatDayMonth(biggest.date)}` : 'Nenhuma despesa no mês'} />
        </div>
      </section>

      <CategoryChart title={kind === 'expense' ? 'Despesas por categoria' : 'Receitas por categoria'} subtitle={formatMonth(month)} kind={kind} rows={rows} />

      <MonthsChart totals={totals} />
    </div>
  )
}

/* ---------- Filtros ---------- */

function Segmented<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[4.25rem] text-xs text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-full bg-surface p-0.5 shadow-card">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${value === o.value ? 'bg-primary text-on-primary' : 'text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- Cartões de número ---------- */

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`.replace('-', '−')

function Tile({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="h-full rounded-3xl bg-surface p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold break-words">{value}</p>
      {children}
      {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Variação contra o mês anterior. A cor vem da direção E de a alta ser boa ou ruim; seta e sinal repetem a informação. */
function Delta({ change, unit, goodWhenUp }: { change: number; unit: string; goodWhenUp: boolean }) {
  const rounded = Math.round(change)
  if (rounded === 0) return <p className="mt-1 text-xs text-muted">Igual ao mês anterior</p>
  const up = rounded > 0
  const good = up === goodWhenUp
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${good ? 'text-income' : 'text-expense'}`}>
      <Icon name={up ? 'up' : 'down'} className="size-3.5" />
      <span>
        {up ? '+' : '−'}
        {Math.abs(rounded)}
        {unit}
      </span>
      <span className="font-normal text-muted">vs mês anterior</span>
    </p>
  )
}

/* ---------- Gráfico de categorias (barras horizontais) ---------- */

function ViewToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={table} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted active:bg-line">
      {table ? 'Ver gráfico' : 'Ver tabela'}
    </button>
  )
}

function CategoryChart({ title, subtitle, kind, rows }: { title: string; subtitle: string; kind: Kind; rows: ReturnType<typeof breakdown> }) {
  const [table, setTable] = useState(false)
  const color = kind === 'expense' ? 'bg-chart-expense' : 'bg-chart-income'

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-card" aria-label={title}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {rows.length > 0 && <ViewToggle table={table} onToggle={() => setTable((t) => !t)} />}
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nada para mostrar neste mês.</p>
      ) : table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Categoria</th>
              <th className="pb-2 text-right font-medium">Valor</th>
              <th className="pb-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? 'outras'} className="border-t border-line">
                <td className="py-2">{r.name}</td>
                <td className="num py-2 text-right">{formatCents(r.cents)}</td>
                <td className="num py-2 text-right text-muted">{percent(r.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id ?? 'outras'}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="num shrink-0">
                  {formatCents(r.cents)} <span className="text-muted">· {percent(r.share)}</span>
                </span>
              </div>
              {/* Barra fina (8px), ponta arredondada, nascendo da base; "Outras" em cinza para não competir. */}
              <div className="h-2 rounded-full bg-line" role="presentation">
                <div className={`h-full rounded-r-[4px] rounded-l-full transition-[width] duration-500 ${r.id === null ? 'bg-muted' : color}`} style={{ width: `${Math.max(r.share * 100, 1.5)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- Gráfico de meses (colunas agrupadas) ---------- */

/**
 * Com 12 meses a área rola para os lados e deve abrir mostrando os meses mais recentes (à direita).
 * É usada como `ref` com `key` por período: a área é recriada ao trocar 6/12 meses e rola até o fim
 * assim que entra na tela, sem depender de efeitos nem de tempo.
 */
const scrollToEnd = (el: HTMLDivElement | null) => {
  if (el) el.scrollLeft = el.scrollWidth
}

function MonthsChart({ totals }: { totals: ReturnType<typeof totalsByMonth> }) {
  const [table, setTable] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const selected = totals.find((t) => t.key === picked) ?? totals[totals.length - 1]
  const { top, ticks } = niceScale(Math.max(...totals.map((t) => Math.max(t.income, t.expense))))
  const empty = totals.every((t) => t.income === 0 && t.expense === 0)

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-card" aria-label="Receitas e despesas por mês">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Receitas e despesas por mês</h2>
          <p className="text-xs text-muted">Últimos {totals.length} meses</p>
        </div>
        {!empty && <ViewToggle table={table} onToggle={() => setTable((t) => !t)} />}
      </div>

      {/* Legenda sempre visível: a cor nunca é o único jeito de saber o que é cada barra. */}
      <ul className="mb-3 flex gap-4 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-income" /> Receitas
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-expense" /> Despesas
        </li>
      </ul>

      {empty ? (
        <p className="py-6 text-center text-sm text-muted">Ainda não há lançamentos nesse período.</p>
      ) : table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Mês</th>
                <th className="pb-2 text-right font-medium">Receitas</th>
                <th className="pb-2 text-right font-medium">Despesas</th>
                <th className="pb-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {[...totals].reverse().map((t) => (
                <tr key={t.key} className="border-t border-line">
                  <td className="py-2">
                    {shortMonth(t.month)}/{String(t.month.getFullYear()).slice(2)}
                  </td>
                  <td className="num py-2 text-right">{formatCents(t.income)}</td>
                  <td className="num py-2 text-right">{formatCents(t.expense)}</td>
                  <td className="num py-2 text-right font-medium">{formatCents(t.income - t.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mt-7 flex">
            {/* Eixo vertical: marcas redondas, texto discreto. */}
            <div className="relative mr-2 w-10 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className="num absolute right-0 -translate-y-1/2 text-[11px] text-muted" style={{ bottom: `${(t / top) * 100}%` }}>
                  {formatCompact(t)}
                </span>
              ))}
            </div>

            <div key={totals.length} ref={scrollToEnd} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]">
              <div className="relative" style={{ minWidth: totals.length * MIN_COLUMN, height: PLOT_HEIGHT + 28 }}>
                <div className="absolute inset-x-0 top-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
                  {ticks.map((t) => (
                    <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-muted/40' : 'border-line'}`} style={{ bottom: `${(t / top) * 100}%` }} />
                  ))}
                </div>

                <div className="relative flex h-full">
                  {totals.map((t) => {
                    const active = t.key === selected.key
                    return (
                      <button
                        key={t.key}
                        onClick={() => setPicked(t.key)}
                        aria-pressed={active}
                        aria-label={`${formatMonth(t.month)}: receitas ${formatCents(t.income)}, despesas ${formatCents(t.expense)}`}
                        className={`flex min-w-0 flex-1 flex-col rounded-xl transition-colors ${active ? 'bg-line/60' : ''}`}
                      >
                        <span className="flex w-full items-end justify-center gap-0.5 px-1" style={{ height: PLOT_HEIGHT }}>
                          <Bar value={t.income} top={top} className="bg-chart-income" />
                          <Bar value={t.expense} top={top} className="bg-chart-expense" />
                        </span>
                        <span className={`mt-auto pb-1 text-[11px] ${active ? 'font-semibold text-text' : 'text-muted'}`}>{shortMonth(t.month)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* O que o toque/foco mostra: o mesmo que o mouse mostraria, sem depender de tooltip. */}
          <div role="status" aria-live="polite" className="mt-3 rounded-2xl bg-bg p-3 text-sm">
            <p className="font-medium">{formatMonth(selected.month)}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="flex items-center gap-1.5 text-muted">
                <span className="size-2.5 rounded-sm bg-chart-income" /> Receitas
              </dt>
              <dd className="num text-right">+ {formatCents(selected.income)}</dd>
              <dt className="flex items-center gap-1.5 text-muted">
                <span className="size-2.5 rounded-sm bg-chart-expense" /> Despesas
              </dt>
              <dd className="num text-right">− {formatCents(selected.expense)}</dd>
              <dt className="text-muted">Saldo</dt>
              <dd className="num text-right font-semibold">{formatCents(selected.income - selected.expense)}</dd>
            </dl>
          </div>
        </>
      )}
    </section>
  )
}

/** Uma coluna: no máximo 20px de largura, ponta de cima arredondada em 4px, base reta. */
function Bar({ value, top, className }: { value: number; top: number; className: string }) {
  if (value <= 0) return <span className="w-full max-w-5" />
  return <span className={`w-full max-w-5 rounded-t-[4px] ${className}`} style={{ height: `${Math.max((value / top) * 100, 1.5)}%` }} aria-hidden="true" />
}
