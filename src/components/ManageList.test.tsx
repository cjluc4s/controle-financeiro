// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ManageList } from './ManageList'

const items = [
  { id: 1, name: 'Carteira' },
  { id: 2, name: 'Poupança' },
]

function setup(props: Partial<React.ComponentProps<typeof ManageList>> = {}) {
  const handlers = {
    onAdd: vi.fn(() => Promise.resolve(true)),
    onRename: vi.fn(() => Promise.resolve(true)),
    onDelete: vi.fn(() => Promise.resolve(true)),
  }
  render(<ManageList title="Contas" items={items} usage={new Map([[1, 3]])} addLabel="Nova conta" {...handlers} {...props} />)
  return handlers
}

describe('ManageList', () => {
  it('item em uso tem o botão de excluir desabilitado, e mostra quantos lançamentos usam', () => {
    setup()
    expect(screen.getByRole('button', { name: /carteira está em uso/i })).toBeDisabled()
    expect(screen.getByText('3 lanç.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir Poupança' })).toBeEnabled()
  })

  it('exclui um item sem uso', async () => {
    const user = userEvent.setup()
    const { onDelete } = setup()
    await user.click(screen.getByRole('button', { name: 'Excluir Poupança' }))
    expect(onDelete).toHaveBeenCalledWith(2)
  })

  it('com keepOne, o único item restante não pode ser excluído', () => {
    setup({ items: [{ id: 2, name: 'Poupança' }], usage: new Map(), keepOne: true })
    expect(screen.getByRole('button', { name: /último item/i })).toBeDisabled()
  })

  it('adiciona com o nome sem espaços nas pontas e limpa o campo', async () => {
    const user = userEvent.setup()
    const { onAdd } = setup()
    const field = screen.getByPlaceholderText('Nova conta')
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()

    await user.type(field, '  Cofrinho  ')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).toHaveBeenCalledWith('Cofrinho')
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('se não conseguiu adicionar, mantém o que a pessoa digitou', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(() => Promise.resolve(false))
    setup({ onAdd })
    const field = screen.getByPlaceholderText('Nova conta')
    await user.type(field, 'Cofrinho{Enter}')
    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(field).toHaveValue('Cofrinho')
  })

  it('renomeia ao sair do campo', async () => {
    const user = userEvent.setup()
    const { onRename } = setup()
    const field = screen.getByLabelText('Nome: Poupança')
    await user.clear(field)
    await user.type(field, 'Reserva{Enter}')
    expect(onRename).toHaveBeenCalledWith(2, 'Reserva')
  })

  it('nome em branco volta ao nome anterior sem chamar o salvamento', async () => {
    const user = userEvent.setup()
    const { onRename } = setup()
    const field = screen.getByLabelText('Nome: Poupança')
    await user.clear(field)
    await user.type(field, '   {Enter}')
    expect(onRename).not.toHaveBeenCalled()
    expect(field).toHaveValue('Poupança')
  })

  it('se o renomear falhar, volta ao nome anterior', async () => {
    const user = userEvent.setup()
    setup({ onRename: vi.fn(() => Promise.resolve(false)) })
    const field = screen.getByLabelText('Nome: Poupança')
    await user.clear(field)
    await user.type(field, 'Reserva{Enter}')
    await waitFor(() => expect(field).toHaveValue('Poupança'))
  })

  it('mostra o erro recebido logo abaixo da lista', () => {
    setup({ error: 'Esta conta tem lançamentos e não pode ser excluída.' })
    expect(screen.getByRole('alert')).toHaveTextContent('tem lançamentos')
  })
})
