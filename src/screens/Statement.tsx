import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { TxRow } from '../components/TxRow'
import type { Category, Tx } from '../db'
import { nameMap, newestFirst } from '../lib/tx'

interface Props {
  txs: Tx[]
  categories: Category[]
  onOpenTx: (tx: Tx) => void
}

export function Statement({ txs, categories, onOpenTx }: Props) {
  const [query, setQuery] = useState('')
  const names = useMemo(() => nameMap(categories), [categories])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR')
    return [...txs].filter((t) => !q || t.note.toLocaleLowerCase('pt-BR').includes(q) || (names.get(t.categoryId) ?? '').toLocaleLowerCase('pt-BR').includes(q)).sort(newestFirst)
  }, [txs, names, query])

  return (
    <>
      <label className="anim-fade flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 focus-within:border-primary">
        <Icon name="search" className="size-5 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por descrição ou categoria"
          aria-label="Buscar lançamentos"
          className="w-full bg-transparent outline-none placeholder:text-muted"
        />
      </label>

      <section className="anim-fade rounded-3xl bg-surface p-2 shadow-card">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-muted">{txs.length === 0 ? 'Nenhum lançamento neste mês.' : 'Nada encontrado para essa busca.'}</p>
        ) : (
          <ul>
            {rows.map((t) => (
              <TxRow key={t.id} tx={t} categoryName={names.get(t.categoryId) ?? 'Sem categoria'} onOpen={onOpenTx} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
