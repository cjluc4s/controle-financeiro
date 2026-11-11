import { useState } from 'react'
import { Icon } from './Icon'

interface Item {
  id: number
  name: string
}

interface Props {
  title: string
  items: Item[]
  /** Quantos lançamentos usam cada item; itens em uso não podem ser excluídos. */
  usage: Map<number, number>
  addLabel: string
  onAdd: (name: string) => void | Promise<void>
  onRename: (id: number, name: string) => void | Promise<void>
  onDelete: (id: number) => void | Promise<void>
}

export function ManageList({ title, items, usage, addLabel, onAdd, onRename, onDelete }: Props) {
  const [draft, setDraft] = useState('')

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {items.map((item) => {
          const used = usage.get(item.id) ?? 0
          return (
            <li key={`${item.id}-${item.name}`} className="flex items-center gap-2 px-3 py-1">
              <input
                defaultValue={item.name}
                maxLength={30}
                aria-label={`Nome: ${item.name}`}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== item.name) void onRename(item.id, name)
                  else e.target.value = item.name
                }}
                className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
              />
              {used > 0 && <span className="text-xs text-muted">{used} lanç.</span>}
              <button
                onClick={() => void onDelete(item.id)}
                disabled={used > 0}
                aria-label={used > 0 ? `${item.name} está em uso e não pode ser excluído` : `Excluir ${item.name}`}
                className="grid size-9 place-items-center rounded-full text-expense active:bg-expense-soft disabled:opacity-30"
              >
                <Icon name="trash" className="size-5" />
              </button>
            </li>
          )
        })}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = draft.trim()
          if (!name) return
          void onAdd(name)
          setDraft('')
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder={addLabel} className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-primary" />
        <button type="submit" disabled={!draft.trim()} className="rounded-2xl bg-primary px-4 font-semibold text-on-primary active:scale-95 disabled:opacity-40">
          Adicionar
        </button>
      </form>
    </div>
  )
}
