import { useEffect, useMemo, useRef, useState } from 'react'
import { DataError, deleteTx, saveTx } from '../data'
import type { Account, Category, Kind, Tx } from '../db'
import { isValidISODate } from '../lib/dates'
import { centsToInput, maskAmount, parseMaskedToCents } from '../lib/money'
import { Icon } from './Icon'

interface Props {
  tx?: Tx
  defaultDate: string
  categories: Category[]
  accounts: Account[]
  onClose: () => void
}

export function TxSheet({ tx, defaultDate, categories, accounts, onClose }: Props) {
  const [kind, setKind] = useState<Kind>(tx?.kind ?? 'expense')
  const [value, setValue] = useState(tx ? centsToInput(tx.cents) : '')
  const [date, setDate] = useState(tx?.date ?? defaultDate)
  const [categoryId, setCategoryId] = useState<number | undefined>(tx?.categoryId)
  const [accountId, setAccountId] = useState<number | undefined>(tx?.accountId ?? accounts[0]?.id)
  const [note, setNote] = useState(tx?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const kindCategories = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind])
  // Se a categoria escolhida não é do tipo atual (ex.: trocou de despesa para receita), usa a primeira do tipo.
  const activeCategory = kindCategories.find((c) => c.id === categoryId) ?? kindCategories[0]
  // Mesma ideia para a conta: se a escolhida foi excluída enquanto a folha estava aberta, usa a primeira.
  const activeAccount = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const cents = parseMaskedToCents(value)
  const canSave = cents !== null && cents > 0 && activeCategory !== undefined && activeAccount !== undefined && isValidISODate(date)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Em telas baixas a mensagem de erro fica abaixo da dobra da folha: rola só a folha até o fim
  // (scrollIntoView poderia rolar também a página que está por trás).
  useEffect(() => {
    if (error && formRef.current) formRef.current.scrollTop = formRef.current.scrollHeight
  }, [error])

  async function save() {
    if (saving || !canSave) return
    setSaving(true)
    setError(null)
    try {
      await saveTx(tx?.id, { kind, cents, date, categoryId: activeCategory.id, accountId: activeAccount.id, note })
      onClose()
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!tx || saving) return
    setSaving(true)
    setError(null)
    try {
      await deleteTx(tx.id)
      onClose()
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <button aria-label="Fechar" onClick={onClose} className="anim-fade absolute inset-0 bg-black/50" />
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-label={tx ? 'Editar lançamento' : 'Novo lançamento'}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="anim-sheet relative max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tx ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-full text-muted active:bg-line">
            <Icon name="close" />
          </button>
        </div>

        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2 rounded-2xl bg-bg p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${kind === k ? (k === 'income' ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense') : 'text-muted'}`}
            >
              <Icon name={k === 'income' ? 'up' : 'down'} className="size-4" />
              {k === 'income' ? 'Receita' : 'Despesa'}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-sm text-muted">Valor</span>
          <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-primary">
            <span className="text-2xl text-muted">R$</span>
            <input autoFocus={!tx} inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => setValue(maskAmount(e.target.value))} className="num min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-muted/50" />
          </div>
        </label>

        <div>
          <span className="text-sm text-muted">Categoria</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {kindCategories.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={activeCategory?.id === c.id} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${activeCategory?.id === c.id ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'}`}>
                {c.name}
              </button>
            ))}
            {kindCategories.length === 0 && <p className="text-sm text-muted">Crie uma categoria em Ajustes.</p>}
          </div>
        </div>

        {/* Duas colunas de largura igual (minmax(0,1fr) impede que um campo empurre o outro);
            em telas muito estreitas (< 350px) os campos ficam um embaixo do outro. */}
        <div className="grid grid-cols-1 gap-3 min-[350px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block min-w-0">
            <span className="text-sm text-muted">Data</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 box-border block h-12 w-full min-w-0 rounded-2xl border border-line bg-bg px-3 text-left outline-none focus:border-primary" />
          </label>
          <label className="block min-w-0">
            <span className="text-sm text-muted">Conta</span>
            <select value={activeAccount?.id ?? ''} onChange={(e) => setAccountId(Number(e.target.value))} className="mt-1 box-border block h-12 w-full min-w-0 rounded-2xl border border-line bg-bg px-3 outline-none focus:border-primary">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Descrição (opcional)" maxLength={80} className="w-full rounded-2xl border border-line bg-bg px-4 py-3 outline-none focus:border-primary" />

        {error && (
          <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-sm text-expense">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSave || saving} className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-on-primary transition-opacity active:scale-[0.98] disabled:opacity-40">
          Salvar
        </button>

        {tx &&
          (confirmDelete ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-2xl border border-line py-3 font-medium text-muted">
                Cancelar
              </button>
              <button type="button" onClick={() => void remove()} disabled={saving} className="rounded-2xl bg-expense-soft py-3 font-semibold text-expense disabled:opacity-50">
                Confirmar exclusão
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium text-expense active:bg-expense-soft">
              <Icon name="trash" className="size-5" /> Excluir lançamento
            </button>
          ))}
      </form>
    </div>
  )
}
