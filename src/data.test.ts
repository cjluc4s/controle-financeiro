import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, hasLocalData, parseBackup, restoreBackup } from './backup'
import { addAccount, addCategory, DataError, deleteAccount, deleteCategory, renameCategory, saveTx, type TxInput } from './data'
import { db } from './db'

// Recria o banco do zero (com as categorias e contas iniciais) antes de cada teste.
beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function firstOf(kind: 'income' | 'expense') {
  const category = (await db.categories.where('kind').equals(kind).first())!
  const account = (await db.accounts.toCollection().first())!
  return { category, account }
}

async function input(overrides: Partial<TxInput> = {}): Promise<TxInput> {
  const { category, account } = await firstOf('expense')
  return { kind: 'expense', cents: 1500, date: '2026-10-08', categoryId: category.id, accountId: account.id, note: 'Teste', ...overrides }
}

/** Espera que a operação falhe com um DataError (e, se informado, com um texto que combine). */
async function expectDataError(promise: Promise<unknown>, message?: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(DataError)
  expect(error instanceof Error ? error.message : '').toMatch(message ?? /./)
}

describe('saveTx', () => {
  it('cria e atualiza um lançamento', async () => {
    await saveTx(undefined, await input())
    const created = (await db.transactions.toArray())[0]!
    expect(created).toMatchObject({ cents: 1500, note: 'Teste' })

    await saveTx(created.id, await input({ cents: 2000, note: '  novo  ' }))
    expect(await db.transactions.get(created.id)).toMatchObject({ cents: 2000, note: 'novo' })
    expect(await db.transactions.count()).toBe(1)
  })

  it('recusa categoria que não existe, de outro tipo, ou conta que não existe', async () => {
    await expectDataError(saveTx(undefined, await input({ categoryId: 999 })), /categoria/)
    const income = await firstOf('income')
    await expectDataError(saveTx(undefined, await input({ categoryId: income.category.id })), /categoria/)
    await expectDataError(saveTx(undefined, await input({ accountId: 999 })), /conta/)
    expect(await db.transactions.count()).toBe(0)
  })

  it('recusa valor e data inválidos', async () => {
    for (const cents of [0, -5, 10.5, Number.NaN, 10 ** 12]) await expectDataError(saveTx(undefined, await input({ cents })), /valor/)
    for (const date of ['2026-02-30', '2026-13-01', '08/10/2026', '']) await expectDataError(saveTx(undefined, await input({ date })), /data/)
  })

  it('recusa editar um lançamento que foi excluído', async () => {
    await expectDataError(saveTx(12345, await input()), /não existe mais/)
  })
})

describe('categorias e contas', () => {
  it('não exclui categoria em uso, mas exclui a que ninguém usa', async () => {
    const data = await input()
    await saveTx(undefined, data)
    await expectDataError(deleteCategory(data.categoryId), /lançamentos/)
    expect(await db.categories.get(data.categoryId)).toBeDefined()

    await addCategory('Pets', 'expense')
    const pets = (await db.categories.filter((c) => c.name === 'Pets').first())!
    await deleteCategory(pets.id)
    expect(await db.categories.get(pets.id)).toBeUndefined()
  })

  it('não exclui conta em uso nem a última conta', async () => {
    const data = await input()
    await saveTx(undefined, data)
    await expectDataError(deleteAccount(data.accountId), /lançamentos/)

    const unused = (await db.accounts.toArray()).find((a) => a.id !== data.accountId)!
    await deleteAccount(unused.id)
    await db.transactions.clear()
    await expectDataError(deleteAccount(data.accountId), /pelo menos uma conta/)
    expect(await db.accounts.count()).toBe(1)
  })

  it('valida e limpa o nome', async () => {
    await expectDataError(addAccount('   '), /nome/i)
    await expectDataError(addCategory('x'.repeat(31), 'expense'), /no máximo/)
    await addAccount('  Poupança  ')
    expect(await db.accounts.filter((a) => a.name === 'Poupança').count()).toBe(1)
    const { category } = await firstOf('expense')
    await expectDataError(renameCategory(category.id, ''), /nome/i)
  })
})

describe('backup no banco', () => {
  it('exportar e restaurar devolve os mesmos dados', async () => {
    await saveTx(undefined, await input())
    const before = await buildBackup()
    expect(parseBackup(JSON.stringify(before)).ok).toBe(true)

    await db.transactions.clear()
    await restoreBackup(before)
    const after = await buildBackup()
    expect({ ...after, exportedAt: '' }).toEqual({ ...before, exportedAt: '' })
  })

  it('hasLocalData: falso no banco recém-criado, verdadeiro com conta nova', async () => {
    expect(await hasLocalData()).toBe(false)
    await addAccount('Nova')
    expect(await hasLocalData()).toBe(true)
  })
})
