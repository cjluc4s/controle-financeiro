// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigation } from './useNavigation'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useNavigation', () => {
  it('começa na aba indicada pelo endereço (recarregar mantém a aba)', () => {
    window.history.replaceState(null, '', '/#/ajustes')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.tab).toBe('settings')
  })

  it('endereço desconhecido cai no Início', () => {
    window.history.replaceState(null, '', '/#/qualquer-coisa')
    const { result } = renderHook(() => useNavigation())
    expect(result.current.tab).toBe('home')
  })

  it('trocar de aba atualiza o endereço, e Voltar retorna à aba anterior', async () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.setTab('list'))
    act(() => result.current.setTab('reports'))
    expect(window.location.hash).toBe('#/relatorios')
    expect(result.current.tab).toBe('reports')

    act(() => window.history.back())
    await waitFor(() => expect(result.current.tab).toBe('list'))
    act(() => window.history.back())
    await waitFor(() => expect(result.current.tab).toBe('home'))
  })

  it('escolher a mesma aba de novo não empilha outra entrada no histórico', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.setTab('list'))
    const length = window.history.length
    act(() => result.current.setTab('list'))
    expect(window.history.length).toBe(length)
  })

  it('a folha entra no histórico: Voltar fecha a folha e fica na mesma aba', async () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.setTab('list'))
    act(() => result.current.openOverlay())
    expect(result.current.overlay).toBe(true)

    act(() => window.history.back())
    await waitFor(() => expect(result.current.overlay).toBe(false))
    expect(result.current.tab).toBe('list')
    expect(window.location.hash).toBe('#/extrato')
  })

  it('fechar pelo app também sai da entrada do histórico, e fechar duas vezes não volta duas telas', async () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.setTab('list'))
    act(() => result.current.openOverlay())
    act(() => {
      result.current.closeOverlay()
      result.current.closeOverlay() // Esc apertado duas vezes seguidas
    })
    await waitFor(() => expect(result.current.overlay).toBe(false))
    await new Promise((resolve) => setTimeout(resolve, 50)) // espera um eventual segundo "voltar" indevido
    expect(result.current.tab).toBe('list')
  })

  it('abrir a folha duas vezes não empilha duas entradas', () => {
    const { result } = renderHook(() => useNavigation())
    act(() => result.current.openOverlay())
    const length = window.history.length
    act(() => result.current.openOverlay())
    expect(window.history.length).toBe(length)
  })
})
