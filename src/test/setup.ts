import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

// Os testes de tela usam o ambiente jsdom (indicado no topo de cada arquivo); os de lógica rodam em Node puro.
afterEach(() => cleanup())
