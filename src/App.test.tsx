// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { db } from './db'
import { resetDb } from './test/db'

beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  await resetDb()
})

const fab = async () => (await screen.findAllByRole('button', { name: 'Novo lançamento' }))[0]!

async function addExpense(user: ReturnType<typeof userEvent.setup>, value: string, note: string) {
  await user.click(await fab())
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/valor/i), value)
  await user.type(within(dialog).getByPlaceholderText(/descrição/i), note)
  await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('App', () => {
  it('começa vazio, aceita o primeiro lançamento e mostra o saldo do mês', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Nenhum lançamento neste mês')).toBeInTheDocument()

    await addExpense(user, '25,90', 'Padaria')
    expect(await screen.findByText('Padaria')).toBeInTheDocument()
    expect(screen.getAllByText(/25,90/).length).toBeGreaterThan(0)
    expect(await db.transactions.count()).toBe(1)
  })

  it('o botão Voltar fecha a folha de lançamento em vez de sair da tela', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await fab())
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    window.history.back()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: 'Novo lançamento' }).length).toBeGreaterThan(0)
  })

  it('navega entre as abas, inclusive as carregadas sob demanda, e o endereço acompanha', async () => {
    const user = userEvent.setup()
    render(<App />)
    await fab()

    await user.click(screen.getByRole('button', { name: 'Extrato' }))
    expect(await screen.findByLabelText('Buscar lançamentos')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/extrato')

    await user.click(screen.getByRole('button', { name: 'Relatórios' }))
    expect(await screen.findByText('Receitas e despesas por mês')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    expect(await screen.findByRole('heading', { name: 'Backup' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/ajustes')

    window.history.back()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Relatórios' })).toHaveAttribute('aria-current', 'page'))
  })

  it('abre direto na aba indicada pelo endereço', async () => {
    window.history.replaceState(null, '', '/#/ajustes')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Backup' })).toBeInTheDocument()
  })

  it('avisa que ainda não há backup quando já existem lançamentos', async () => {
    const category = (await db.categories.toCollection().first())!
    const account = (await db.accounts.toCollection().first())!
    await db.transactions.add({ kind: 'expense', cents: 1000, date: new Date().toISOString().slice(0, 7) + '-01', categoryId: category.id, accountId: account.id, note: 'x' })

    render(<App />)
    expect(await screen.findByText('Você ainda não fez backup')).toBeInTheDocument()
  })

  it('busca no extrato filtra por descrição', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExpense(user, '10', 'Pizza')
    await addExpense(user, '20', 'Livro')

    await user.click(screen.getByRole('button', { name: 'Extrato' }))
    const search = await screen.findByLabelText('Buscar lançamentos')
    await user.type(search, 'piz')
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.queryByText('Livro')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText('Nada encontrado para essa busca.')).toBeInTheDocument()
  })
})
