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
  /** Se true, o último item da lista não pode ser excluído. */
  keepOne?: boolean
  /** Erro da última alteração nesta lista; aparece logo abaixo dela, perto de onde a pessoa tocou. */
  error?: string | null
  /** Cada ação devolve `false` quando falhou (o erro já foi mostrado por quem chamou). */
  onAdd: (name: string) => Promise<boolean>
  onRename: (id: number, name: string) => Promise<boolean>
  onDelete: (id: number) => Promise<boolean>
}

export function ManageList({ title, items, usage, addLabel, keepOne = false, error = null, onAdd, onRename, onDelete }: Props) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {items.map((item) => {
          const used = usage.get(item.id) ?? 0
          const isLast = keepOne && items.length <= 1
          return (
            <li key={`${item.id}-${item.name}`} className="flex items-center gap-2 px-3 py-1">
              <input
                defaultValue={item.name}
                maxLength={30}
                aria-label={`Nome: ${item.name}`}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => {
                  const input = e.target
                  const name = input.value.trim()
                  if (name && name !== item.name) {
                    // Se não der para renomear, volta ao nome anterior em vez de deixar um nome que não foi salvo.
                    void onRename(item.id, name).then((ok) => {
                      if (!ok) input.value = item.name
                    })
                  } else input.value = item.name
                }}
                className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
              />
              {used > 0 && <span className="text-xs text-muted">{used} lanç.</span>}
              <button
                onClick={() => void onDelete(item.id)}
                disabled={used > 0 || isLast}
                aria-label={used > 0 ? `${item.name} está em uso e não pode ser excluído` : isLast ? `${item.name} é o último item e não pode ser excluído` : `Excluir ${item.name}`}
                className="grid size-9 place-items-center rounded-full text-expense active:bg-expense-soft disabled:opacity-30"
              >
                <Icon name="trash" className="size-5" />
              </button>
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 rounded-2xl bg-expense-soft px-4 py-3 text-sm text-expense">
          {error}
        </p>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = draft.trim()
          if (!name || adding) return
          setAdding(true)
          // Só limpa o campo se deu certo, para não perder o que a pessoa digitou.
          void onAdd(name)
            .then((ok) => ok && setDraft(''))
            .finally(() => setAdding(false))
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={30}
          placeholder={addLabel}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-primary"
        />
        <button type="submit" disabled={!draft.trim() || adding} className="rounded-2xl bg-primary px-4 font-semibold text-on-primary active:scale-95 disabled:opacity-40">
          Adicionar
        </button>
      </form>
    </div>
  )
}
