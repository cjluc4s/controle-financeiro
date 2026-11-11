import { z } from 'zod'
import { db } from './db'
import { isValidISODate, toISODate } from './lib/dates'
import { setLastBackup } from './lib/lastBackup'
import { MAX_CENTS } from './lib/money'

const kind = z.enum(['income', 'expense'])
const id = z.number().int().positive()

// Os limites de tamanho são os mesmos dos campos do app (nome: 30, descrição: 80).
const NAME_MAX = 30
const NOTE_MAX = 80
// Quantidade de contas, categorias e lançamentos: só um teto para recusar arquivos absurdos.
const MAX_ITEMS = 500_000

const backupSchema = z.object({
  app: z.literal('controle-financeiro'),
  version: z.literal(1),
  exportedAt: z.string(),
  categories: z.array(z.object({ id, name: z.string().min(1).max(NAME_MAX), kind })).max(MAX_ITEMS),
  accounts: z.array(z.object({ id, name: z.string().min(1).max(NAME_MAX) })).max(MAX_ITEMS),
  transactions: z
    .array(
      z.object({
        id,
        kind,
        cents: z.number().int().positive().max(MAX_CENTS),
        date: z.string().refine(isValidISODate, 'data inválida'),
        categoryId: id,
        accountId: id,
        note: z.string().max(NOTE_MAX),
      }),
    )
    .max(MAX_ITEMS),
})

export type Backup = z.infer<typeof backupSchema>

export type ParseResult = { ok: true; data: Backup } | { ok: false; error: string }

/** Valida o conteúdo de um arquivo de backup, inclusive se categorias e contas citadas existem. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const fromThisApp = typeof raw === 'object' && raw !== null && (raw as { app?: unknown }).app === 'controle-financeiro'
    return {
      ok: false,
      error: fromThisApp ? 'O backup tem valores inválidos (valor, data ou texto fora do permitido).' : 'O arquivo não parece ser um backup deste app.',
    }
  }
  const data = parsed.data

  // Ids repetidos fariam a importação falhar no meio; melhor avisar antes.
  const hasDuplicates = [data.categories, data.accounts, data.transactions].some((rows) => new Set(rows.map((r) => r.id)).size !== rows.length)
  if (hasDuplicates) return { ok: false, error: 'O backup tem itens repetidos (mesmo identificador usado duas vezes).' }

  const categoryKind = new Map(data.categories.map((c) => [c.id, c.kind]))
  const accountIds = new Set(data.accounts.map((a) => a.id))
  const orphan = data.transactions.some((t) => !categoryKind.has(t.categoryId) || !accountIds.has(t.accountId))
  if (orphan) return { ok: false, error: 'O backup tem lançamentos ligados a categorias ou contas que não existem.' }
  const wrongKind = data.transactions.some((t) => categoryKind.get(t.categoryId) !== t.kind)
  if (wrongKind) return { ok: false, error: 'O backup tem lançamentos de receita ou despesa ligados a uma categoria do tipo oposto.' }
  return { ok: true, data }
}

// Quantidade de categorias e contas criadas na primeira abertura do banco (ver db.ts).
const DEFAULT_CATEGORIES = 8
const DEFAULT_ACCOUNTS = 2

/**
 * Há algo que valha proteger antes de substituir tudo? Lançamentos, ou categorias/contas além das iniciais.
 * (Só renomear as iniciais não conta; a perda seria pequena.)
 */
export async function hasLocalData(): Promise<boolean> {
  const [tx, categories, accounts] = await Promise.all([db.transactions.count(), db.categories.count(), db.accounts.count()])
  return tx > 0 || categories !== DEFAULT_CATEGORIES || accounts !== DEFAULT_ACCOUNTS
}

export async function buildBackup(): Promise<Backup> {
  const [categories, accounts, transactions] = await Promise.all([db.categories.toArray(), db.accounts.toArray(), db.transactions.toArray()])
  return { app: 'controle-financeiro', version: 1, exportedAt: new Date().toISOString(), categories, accounts, transactions }
}

/** Substitui TODOS os dados do aparelho pelo conteúdo do backup. */
export async function restoreBackup(data: Backup): Promise<void> {
  await db.transaction('rw', db.categories, db.accounts, db.transactions, async () => {
    await Promise.all([db.categories.clear(), db.accounts.clear(), db.transactions.clear()])
    await db.categories.bulkAdd(data.categories)
    await db.accounts.bulkAdd(data.accounts)
    await db.transactions.bulkAdd(data.transactions)
  })
}

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Abre a folha de compartilhar do celular (AirDrop, WhatsApp, Drive...) ou baixa o arquivo. */
export async function exportBackup(): Promise<ExportOutcome> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const name = `financas-backup-${toISODate(new Date())}.json`
  const file = new File([json], name, { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup do Controle Financeiro' })
      setLastBackup(toISODate(new Date()))
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Qualquer outra falha do compartilhamento: cai para o download direto.
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  setLastBackup(toISODate(new Date()))
  return 'downloaded'
}
