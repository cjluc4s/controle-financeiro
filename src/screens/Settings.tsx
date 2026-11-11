import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { exportBackup, hasLocalData, parseBackup, restoreBackup } from '../backup'
import { Icon } from '../components/Icon'
import { ManageList } from '../components/ManageList'
import { addAccount, addCategory, DataError, deleteAccount, deleteCategory, renameAccount, renameCategory } from '../data'
import { db } from '../db'
import { useAccounts, useCategories } from '../hooks/useData'
import type { Theme } from '../hooks/useTheme'
import { daysSince } from '../lib/dates'
import { getLastBackup } from '../lib/lastBackup'

interface Props {
  theme: Theme
  onTheme: (t: Theme) => void
}

type ListId = 'expense' | 'income' | 'accounts'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
]

export function Settings({ theme, onTheme }: Props) {
  const categories = useCategories()
  const accounts = useAccounts()
  const usage = useLiveQuery(async () => {
    const byCategory = new Map<number, number>()
    const byAccount = new Map<number, number>()
    await db.transactions.each((t) => {
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + 1)
      byAccount.set(t.accountId, (byAccount.get(t.accountId) ?? 0) + 1)
    })
    return { byCategory, byAccount }
  }, [])

  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastBackup, setLastBackupState] = useState(getLastBackup())
  // O erro aparece na lista onde a pessoa mexeu (a tela é longa; um erro no fim passaria despercebido).
  const [listError, setListError] = useState<{ list: ListId; text: string } | null>(null)

  if (!categories || !accounts || !usage) return null

  /** Roda uma alteração de categoria/conta; mostra o erro (se houver) e diz se deu certo. */
  async function change(list: ListId, action: () => Promise<void>): Promise<boolean> {
    setListError(null)
    try {
      await action()
      return true
    } catch (e) {
      setListError({ list, text: e instanceof DataError ? e.message : 'Não foi possível salvar a alteração. Tente de novo.' })
      return false
    }
  }
  const errorOf = (list: ListId) => (listError?.list === list ? listError.text : null)

  const sinceBackup = daysSince(lastBackup)
  const backupText = sinceBackup === null ? 'Nenhum backup feito ainda.' : sinceBackup === 0 ? 'Último backup: hoje.' : `Último backup: há ${sinceBackup} ${sinceBackup === 1 ? 'dia' : 'dias'}.`

  async function onExport() {
    setBusy(true)
    try {
      const outcome = await exportBackup()
      setLastBackupState(getLastBackup())
      if (outcome === 'shared') setStatus({ ok: true, text: 'Backup compartilhado.' })
      else if (outcome === 'downloaded') setStatus({ ok: true, text: 'Backup baixado. Procure o arquivo em Downloads (ou Arquivos).' })
    } catch {
      setStatus({ ok: false, text: 'Não foi possível gerar o backup.' })
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File) {
    setBusy(true)
    try {
      const result = parseBackup(await file.text())
      if (!result.ok) {
        setStatus({ ok: false, text: result.error })
        return
      }
      const { data } = result
      const protect = await hasLocalData()
      const sure = window.confirm(
        `Importar este backup vai SUBSTITUIR todos os dados deste aparelho.\n\nO arquivo tem ${plural(data.transactions.length, 'lançamento', 'lançamentos')}, ${plural(data.categories.length, 'categoria', 'categorias')} e ${plural(data.accounts.length, 'conta', 'contas')}.\n\n${protect ? 'Antes de substituir, vamos salvar uma cópia dos dados atuais.\n\n' : ''}Continuar?`,
      )
      if (!sure) return
      if (protect) {
        // Cópia de segurança dos dados de hoje; se não for salva, não substitui nada.
        const saved = await exportBackup()
        setLastBackupState(getLastBackup())
        if (saved === 'cancelled') {
          setStatus({ ok: false, text: 'Importação cancelada: a cópia dos dados atuais não foi salva, e nada foi alterado.' })
          return
        }
      }
      await restoreBackup(data)
      setStatus({ ok: true, text: `Backup importado: ${plural(data.transactions.length, 'lançamento', 'lançamentos')}.` })
    } catch {
      setStatus({ ok: false, text: 'Não foi possível importar o arquivo.' })
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="anim-fade space-y-4">
      <section className="space-y-3 rounded-3xl bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Aparência</h2>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
          {THEMES.map((opt) => (
            <button
              key={opt.id}
              role="radio"
              aria-checked={theme === opt.id}
              onClick={() => onTheme(opt.id)}
              className={`rounded-2xl border px-1 py-3 text-[13px] font-medium min-[360px]:text-sm transition-colors ${theme === opt.id ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted">Seus dados ficam só neste aparelho. Exporte um arquivo para guardar uma cópia ou levar para o outro celular. {backupText}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void onExport()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-on-primary active:scale-95 disabled:opacity-50"
          >
            <Icon name="share" className="size-5" /> Exportar
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-line py-3 font-semibold active:scale-95 disabled:opacity-50"
          >
            <Icon name="upload" className="size-5" /> Importar
          </button>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} />
        {status && (
          <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${status.ok ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
            {status.text}
          </p>
        )}
      </section>

      <section className="space-y-5 rounded-3xl bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Categorias e contas</h2>
        <ManageList
          title="Categorias de despesa"
          items={categories.filter((c) => c.kind === 'expense')}
          usage={usage.byCategory}
          addLabel="Nova categoria"
          error={errorOf('expense')}
          onAdd={(name) => change('expense', () => addCategory(name, 'expense'))}
          onRename={(id, name) => change('expense', () => renameCategory(id, name))}
          onDelete={(id) => change('expense', () => deleteCategory(id))}
        />
        <ManageList
          title="Categorias de receita"
          items={categories.filter((c) => c.kind === 'income')}
          usage={usage.byCategory}
          addLabel="Nova categoria"
          error={errorOf('income')}
          onAdd={(name) => change('income', () => addCategory(name, 'income'))}
          onRename={(id, name) => change('income', () => renameCategory(id, name))}
          onDelete={(id) => change('income', () => deleteCategory(id))}
        />
        <ManageList
          title="Contas"
          items={accounts}
          usage={usage.byAccount}
          addLabel="Nova conta"
          keepOne
          error={errorOf('accounts')}
          onAdd={(name) => change('accounts', () => addAccount(name))}
          onRename={(id, name) => change('accounts', () => renameAccount(id, name))}
          onDelete={(id) => change('accounts', () => deleteAccount(id))}
        />
        <p className="text-xs text-muted">Categorias e contas com lançamentos não podem ser excluídas, e é preciso manter ao menos uma conta. Você pode renomeá-las.</p>
      </section>
    </div>
  )
}
