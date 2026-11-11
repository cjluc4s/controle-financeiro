import type { Tx } from '../db'
import { formatDayMonth } from '../lib/dates'
import { formatCents } from '../lib/money'
import { Icon } from './Icon'

export function TxRow({ tx, categoryName, onOpen }: { tx: Tx; categoryName: string; onOpen: (tx: Tx) => void }) {
  const income = tx.kind === 'income'
  return (
    <li>
      <button onClick={() => onOpen(tx)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-line/60">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${income ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
          <Icon name={income ? 'up' : 'down'} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{tx.note || categoryName}</span>
          <span className="block truncate text-xs text-muted">
            {categoryName} · {formatDayMonth(tx.date)}
          </span>
        </span>
        <span className={`num shrink-0 whitespace-nowrap font-semibold ${income ? 'text-income' : 'text-expense'}`}>
          {income ? '+' : '−'} {formatCents(tx.cents)}
        </span>
      </button>
    </li>
  )
}
