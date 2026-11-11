import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { monthRange } from '../lib/dates'

// Consultas ao banco que se atualizam sozinhas quando os dados mudam. Retornam `undefined` enquanto carregam.

export const useCategories = () => useLiveQuery(() => db.categories.toArray(), [])

export const useAccounts = () => useLiveQuery(() => db.accounts.toArray(), [])

/** Lançamentos de `from` (inclusive) até `to` (exclusive), datas AAAA-MM-DD. */
export const useTxsBetween = (from: string, to: string) => useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])

/** Lançamentos do mês de `month`. */
export function useMonthTxs(month: Date) {
  const [start, end] = monthRange(month)
  return useTxsBetween(start, end)
}

/** Quantidade de lançamentos em todo o banco (qualquer mês). */
export const useTxCount = () => useLiveQuery(() => db.transactions.count(), [])
