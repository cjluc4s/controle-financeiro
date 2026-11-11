// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type Account, type Category } from '../db'
import { resetDb } from '../test/db'
import { TxSheet } from './TxSheet'

let categories: Category[]
let accounts: Account[]
const onClose = vi.fn()

beforeEach(async () => {
  await resetDb()
  categories = await db.categories.toArray()
  accounts = await db.accounts.toArray()
  onClose.mockClear()
})

const renderSheet = (props: Partial<React.ComponentProps<typeof TxSheet>> = {}) => render(<TxSheet defaultDate="2026-10-08" categories={categories} accounts={accounts} onClose={onClose} {...props} />)

const saveButton = () => screen.getByRole('button', { name: 'Salvar' })
const categoryId = (name: string) => categories.find((c) => c.name === name)!.id

describe('TxSheet', () => {
  it('só habilita Salvar depois de digitar um valor, e formata o valor enquanto digita', async () => {
    const user = userEvent.setup()
    renderSheet()
    expect(saveButton()).toBeDisabled()

    await user.type(screen.getByLabelText(/valor/i), '1000')
    expect(screen.getByLabelText(/valor/i)).toHaveValue('1.000')
    expect(saveButton()).toBeEnabled()
  })

  it('salva uma despesa nova e fecha a folha', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText(/valor/i), '12,5')
    await user.click(screen.getByRole('button', { name: 'Lazer' }))
    await user.type(screen.getByPlaceholderText(/descrição/i), '  Cinema  ')
    await user.click(saveButton())

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const saved = await db.transactions.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ kind: 'expense', cents: 1250, date: '2026-10-08', categoryId: categoryId('Lazer'), note: 'Cinema' })
  })

  it('trocar para Receita mostra as categorias de receita', async () => {
    const user = userEvent.setup()
    renderSheet()
    expect(screen.getByRole('button', { name: 'Mercado' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /receita/i }))
    expect(screen.getByRole('button', { name: 'Salário' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mercado' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/valor/i), '3000')
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.transactions.toArray()).toMatchObject([{ kind: 'income', cents: 300000, categoryId: categoryId('Salário') }])
  })

  it('mostra o erro e continua aberta quando a categoria foi apagada por outra aba', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText(/valor/i), '5')
    await user.click(screen.getByRole('button', { name: 'Outros' }))
    await db.categories.delete(categoryId('Outros')) // "outra aba" apagou a categoria

    await user.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(/categoria escolhida não existe mais/i)
    expect(onClose).not.toHaveBeenCalled()
    expect(await db.transactions.count()).toBe(0)
    expect(saveButton()).toBeEnabled() // não ficou travada: dá para escolher outra e tentar de novo

    await user.click(screen.getByRole('button', { name: 'Lazer' }))
    await user.click(saveButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.transactions.count()).toBe(1)
  })

  it('edita um lançamento existente com os valores já preenchidos', async () => {
    const id = await db.transactions.add({ kind: 'expense', cents: 125075, date: '2026-10-02', categoryId: categoryId('Moradia'), accountId: accounts[0]!.id, note: 'Aluguel' })
    const tx = (await db.transactions.get(id))!
    const user = userEvent.setup()
    renderSheet({ tx, defaultDate: tx.date })

    expect(screen.getByLabelText(/valor/i)).toHaveValue('1.250,75')
    expect(screen.getByPlaceholderText(/descrição/i)).toHaveValue('Aluguel')
    await user.clear(screen.getByLabelText(/valor/i))
    await user.type(screen.getByLabelText(/valor/i), '900')
    await user.click(saveButton())

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.transactions.get(id)).toMatchObject({ cents: 90000, note: 'Aluguel' })
    expect(await db.transactions.count()).toBe(1)
  })

  it('excluir pede confirmação antes de apagar', async () => {
    const id = await db.transactions.add({ kind: 'expense', cents: 500, date: '2026-10-02', categoryId: categoryId('Lazer'), accountId: accounts[0]!.id, note: '' })
    const tx = (await db.transactions.get(id))!
    const user = userEvent.setup()
    renderSheet({ tx })

    await user.click(screen.getByRole('button', { name: /excluir lançamento/i }))
    expect(await db.transactions.count()).toBe(1) // ainda não apagou
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.getByRole('button', { name: /excluir lançamento/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /excluir lançamento/i }))
    await user.click(screen.getByRole('button', { name: /confirmar exclusão/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.transactions.count()).toBe(0)
  })

  it('a tecla Esc fecha a folha', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sem categoria do tipo escolhido, orienta a criar uma e não deixa salvar', async () => {
    const user = userEvent.setup()
    renderSheet({ categories: categories.filter((c) => c.kind === 'income') })
    expect(screen.getByText(/crie uma categoria em ajustes/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/valor/i), '10')
    expect(saveButton()).toBeDisabled()
  })
})
