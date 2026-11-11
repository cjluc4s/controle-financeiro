// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { resetDb } from '../test/db'
import { Settings } from './Settings'

const backup = {
  app: 'controle-financeiro',
  version: 1,
  exportedAt: '2026-10-14T12:00:00.000Z',
  categories: [{ id: 1, name: 'Mercado', kind: 'expense' }],
  accounts: [{ id: 1, name: 'Conta única' }],
  transactions: [{ id: 1, kind: 'expense', cents: 999, date: '2026-10-05', categoryId: 1, accountId: 1, note: 'importado' }],
}

const file = (content: unknown) => new File([typeof content === 'string' ? content : JSON.stringify(content)], 'backup.json', { type: 'application/json' })

let downloads = 0

beforeEach(async () => {
  localStorage.clear()
  await resetDb()
  downloads = 0
  // Sem compartilhamento nativo (computador): o backup vira um download, que aqui só é contado.
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:teste'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    downloads++
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
})

async function addSomeData() {
  const category = (await db.categories.toCollection().first())!
  const account = (await db.accounts.toCollection().first())!
  await db.transactions.add({ kind: 'expense', cents: 100, date: '2026-10-01', categoryId: category.id, accountId: account.id, note: 'antigo' })
}

async function importFile(content: unknown) {
  const user = userEvent.setup()
  render(<Settings theme="auto" onTheme={() => undefined} />)
  await screen.findByRole('heading', { name: 'Backup' })
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  await user.upload(input, file(content))
}

describe('Settings > importar backup', () => {
  it('recusa um arquivo que não é backup e não mexe nos dados', async () => {
    await addSomeData()
    await importFile({ foo: 1 })
    expect(await screen.findByRole('status')).toHaveTextContent(/não parece ser um backup/)
    expect(await db.transactions.count()).toBe(1)
  })

  it('com dados no aparelho, guarda uma cópia deles antes de substituir', async () => {
    await addSomeData()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await importFile(backup)

    expect(await screen.findByRole('status')).toHaveTextContent('Backup importado: 1 lançamento.')
    expect(confirm.mock.calls[0]?.[0]).toMatch(/salvar uma cópia dos dados atuais/)
    expect(downloads).toBe(1)
    expect(await db.transactions.toArray()).toMatchObject([{ note: 'importado', cents: 999 }])
    expect(await db.accounts.toArray()).toMatchObject([{ name: 'Conta única' }])
  })

  it('se a cópia de segurança for cancelada, não substitui nada', async () => {
    await addSomeData()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    Object.assign(navigator, { canShare: () => true, share: () => Promise.reject(new DOMException('cancelado', 'AbortError')) })
    await importFile(backup)

    expect(await screen.findByRole('status')).toHaveTextContent(/nada foi alterado/)
    expect(await db.transactions.toArray()).toMatchObject([{ note: 'antigo' }])
  })

  it('banco recém-criado não gera cópia de segurança', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await importFile(backup)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Backup importado/))
    expect(downloads).toBe(0)
  })

  it('se a pessoa desistir na confirmação, nada muda', async () => {
    await addSomeData()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await importFile(backup)
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(downloads).toBe(0)
    expect(await db.transactions.toArray()).toMatchObject([{ note: 'antigo' }])
  })
})

/** Grava um lançamento direto no IndexedDB, sem avisar o Dexie (que atualizaria a tela). */
function addTxBehindTheScenes(categoryId: number) {
  return new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('controle-financeiro')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const conn = open.result
      const tx = conn.transaction('transactions', 'readwrite')
      tx.objectStore('transactions').add({ kind: 'expense', cents: 100, date: '2026-10-01', categoryId, accountId: 1, note: '' })
      tx.oncomplete = () => {
        conn.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

describe('Settings > categorias e contas', () => {
  it('mostra o erro na lista certa quando a categoria passou a ter lançamentos (outra aba)', async () => {
    const user = userEvent.setup()
    render(<Settings theme="auto" onTheme={() => undefined} />)
    const outros = (await db.categories.filter((c) => c.name === 'Outros').first())!
    const button = await screen.findByRole('button', { name: 'Excluir Outros' })
    // Depois da tela carregada, "outra aba" cria um lançamento nessa categoria. A escrita é feita direto no
    // IndexedDB (sem passar pelo Dexie) para a tela não perceber: o botão ainda parece livre, como numa aba desatualizada.
    await addTxBehindTheScenes(outros.id)
    await user.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(/tem lançamentos/)
    expect(await db.categories.get(outros.id)).toBeDefined()
  })
})
