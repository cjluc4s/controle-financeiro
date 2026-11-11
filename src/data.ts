import { db, type Kind, type Tx } from './db'
import { isValidISODate } from './lib/dates'
import { MAX_CENTS } from './lib/money'

/** Erro com texto pronto para mostrar à pessoa. */
export class DataError extends Error {}

export type TxInput = Omit<Tx, 'id'>

const NAME_MAX = 30
const NOTE_MAX = 80

function cleanName(name: string): string {
  const clean = name.trim()
  if (!clean) throw new DataError('Digite um nome.')
  if (clean.length > NAME_MAX) throw new DataError(`O nome pode ter no máximo ${NAME_MAX} letras.`)
  return clean
}

/**
 * Cria ou atualiza um lançamento. Tudo acontece em uma única transação: a categoria e a conta
 * são conferidas no momento de gravar (outra aba pode tê-las excluído enquanto a folha estava aberta).
 */
export async function saveTx(id: number | undefined, input: TxInput): Promise<void> {
  if (!Number.isSafeInteger(input.cents) || input.cents <= 0 || input.cents > MAX_CENTS) throw new DataError('Digite um valor válido.')
  if (!isValidISODate(input.date)) throw new DataError('Escolha uma data válida.')
  const data: TxInput = { ...input, note: input.note.trim().slice(0, NOTE_MAX) }

  await db.transaction('rw', db.categories, db.accounts, db.transactions, async () => {
    const [category, account] = await Promise.all([db.categories.get(data.categoryId), db.accounts.get(data.accountId)])
    if (!category || category.kind !== data.kind) throw new DataError('A categoria escolhida não existe mais. Escolha outra.')
    if (!account) throw new DataError('A conta escolhida não existe mais. Escolha outra.')
    if (id === undefined) {
      await db.transactions.add(data)
    } else if ((await db.transactions.update(id, data)) === 0) {
      throw new DataError('Este lançamento não existe mais.')
    }
  })
}

export async function deleteTx(id: number): Promise<void> {
  await db.transactions.delete(id)
}

export async function addCategory(name: string, kind: Kind): Promise<void> {
  await db.categories.add({ name: cleanName(name), kind })
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await db.categories.update(id, { name: cleanName(name) })
}

export async function addAccount(name: string): Promise<void> {
  await db.accounts.add({ name: cleanName(name) })
}

export async function renameAccount(id: number, name: string): Promise<void> {
  await db.accounts.update(id, { name: cleanName(name) })
}

/** Exclui a categoria só se nenhum lançamento a usa; a conferência e a exclusão são uma operação só. */
export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    if ((await db.transactions.where('categoryId').equals(id).count()) > 0) throw new DataError('Esta categoria tem lançamentos e não pode ser excluída.')
    await db.categories.delete(id)
  })
}

/** Exclui a conta só se nenhum lançamento a usa e se não for a última (todo lançamento precisa de uma conta). */
export async function deleteAccount(id: number): Promise<void> {
  await db.transaction('rw', db.accounts, db.transactions, async () => {
    if ((await db.accounts.count()) <= 1) throw new DataError('É preciso manter pelo menos uma conta.')
    if ((await db.transactions.where('accountId').equals(id).count()) > 0) throw new DataError('Esta conta tem lançamentos e não pode ser excluída.')
    await db.accounts.delete(id)
  })
}
