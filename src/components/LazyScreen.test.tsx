// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { lazy } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LazyScreen } from './LazyScreen'

afterEach(() => vi.restoreAllMocks())

describe('LazyScreen', () => {
  it('mostra a tela depois que ela carrega', async () => {
    const Screen = lazy(() => Promise.resolve({ default: () => <p>Tela carregada</p> }))
    render(
      <LazyScreen>
        <Screen />
      </LazyScreen>,
    )
    expect(await screen.findByText('Tela carregada')).toBeInTheDocument()
  })

  it('se o arquivo da tela não puder ser baixado, avisa e oferece recarregar (sem derrubar o app)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined) // o React registra o erro capturado
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    render(
      <LazyScreen>
        <Broken />
      </LazyScreen>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir esta tela')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
  })
})
