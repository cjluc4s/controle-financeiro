import { z } from 'zod'
import { db } from './db'
import { toISODate } from './lib/dates'

const kind = z.enum(['income', 'expense'])
const id = z.number().int().positive()

const backupSchema = z.object({
  app: z.literal('controle-financeiro'),
  version: z.literal(1),
  exportedAt: z.string(),
  categories: z.array(z.object({ id, name: z.string().min(1), kind })),
  accounts: z.array(z.object({ id, name: z.string().min(1) })),
  transactions: z.array(
    z.object({
      id,
      kind,
      cents: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      categoryId: id,
      accountId: id,
      note: z.string(),
    }),
  ),
})

export type Backup = z.infer<typeof backupSchema>

export type ParseResult = { ok: true; data: Backup } | { ok: false; error: string }

const LAST_BACKUP_KEY = 'lastBackup'

export function getLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

function setLastBackup(iso: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso)
  } catch {
    /* sem armazenamento: o aviso de backup só fica menos preciso */
  }
}

/** Valida o conteúdo de um arquivo de backup, inclusive se categorias e contas citadas existem. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'O arquivo não parece ser um backup deste app.' }
  const data = parsed.data
  const categoryIds = new Set(data.categories.map((c) => c.id))
  const accountIds = new Set(data.accounts.map((a) => a.id))
  const broken = data.transactions.some((t) => !categoryIds.has(t.categoryId) || !accountIds.has(t.accountId))
  if (broken) return { ok: false, error: 'O backup tem lançamentos ligados a categorias ou contas que não existem.' }
  return { ok: true, data }
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
