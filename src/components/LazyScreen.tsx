import { Component, Suspense, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/**
 * Envolve uma tela carregada sob demanda (`lazy`): mostra nada enquanto carrega e, se o arquivo da tela
 * não puder ser baixado (sem internet logo após uma atualização, por exemplo), oferece recarregar o app.
 */
export class LazyScreen extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override render() {
    if (this.state.failed) {
      return (
        <section role="alert" className="rounded-3xl bg-surface p-6 text-center shadow-card">
          <p className="font-semibold">Não foi possível abrir esta tela</p>
          <p className="mt-1 text-sm text-muted">Confira a conexão e tente de novo. Seus dados não foram afetados.</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary active:scale-95">
            Recarregar
          </button>
        </section>
      )
    }
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}
