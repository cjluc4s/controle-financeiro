import { useCallback, useEffect, useRef, useState } from 'react'

export type Tab = 'home' | 'list' | 'reports' | 'settings'

// A aba fica no "#" do endereço: recarregar a página mantém a aba e o botão Voltar do celular passa por elas.
const HASH: Record<Tab, string> = { home: '#/', list: '#/extrato', reports: '#/relatorios', settings: '#/ajustes' }

const TABS: Tab[] = ['home', 'list', 'reports', 'settings']

function tabFromHash(hash: string): Tab {
  return TABS.find((t) => HASH[t] === hash) ?? 'home'
}

/** A entrada atual do histórico é a da folha de lançamento? */
function isOverlayEntry(): boolean {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && 'overlay' in state && state.overlay === true
}

/**
 * Navegação ligada ao histórico do navegador:
 * - cada troca de aba é uma entrada do histórico (Voltar volta para a aba anterior);
 * - a folha de lançamento (overlay) também é uma entrada: Voltar a fecha, em vez de sair do app.
 */
export function useNavigation() {
  const [tab, setTabState] = useState<Tab>(() => tabFromHash(window.location.hash))
  const [overlay, setOverlay] = useState(false)
  // Espelho do `overlay` que vale na hora (o state só atualiza no próximo desenho); evita Voltar duplo.
  const overlayRef = useRef(false)

  useEffect(() => {
    // Recarregar a página com a folha "aberta" no histórico: a folha não existe mais, então limpa a marca.
    if (isOverlayEntry()) window.history.replaceState(null, '')

    const onPop = () => {
      setTabState(tabFromHash(window.location.hash))
      // Avançar (→) até uma entrada de folha não tem como reabrir a folha: a entrada vira uma comum.
      if (isOverlayEntry()) window.history.replaceState(null, '')
      overlayRef.current = false
      setOverlay(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setTab = useCallback((next: Tab) => {
    // Compara com o endereço atual (e não com o state) para nunca empilhar a mesma aba duas vezes.
    if (tabFromHash(window.location.hash) !== next) window.history.pushState(null, '', HASH[next])
    setTabState(next)
  }, [])

  const openOverlay = useCallback(() => {
    if (overlayRef.current) return
    overlayRef.current = true
    window.history.pushState({ overlay: true }, '')
    setOverlay(true)
  }, [])

  const closeOverlay = useCallback(() => {
    if (!overlayRef.current) return
    overlayRef.current = false
    // Voltar no histórico dispara o `popstate`, que fecha a folha. Sem a marca (caso estranho), fecha direto.
    if (isOverlayEntry()) window.history.back()
    else setOverlay(false)
  }, [])

  return { tab, setTab, overlay, openOverlay, closeOverlay }
}
