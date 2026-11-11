import type { Kind } from '../db'

/** Só os campos que os relatórios usam; facilita testar sem montar um lançamento inteiro. */
export interface TxLike {
  kind: Kind
  cents: number
  date: string
  categoryId: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10" para o mês de uma data. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Os últimos `count` meses terminando em `end` (inclusive), do mais antigo ao mais novo, sempre no dia 1. */
export function lastMonths(end: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1))
}

export interface MonthTotals {
  key: string
  month: Date
  income: number
  expense: number
}

/** Soma receitas e despesas de cada mês pedido (meses sem lançamento ficam zerados). */
export function totalsByMonth(txs: TxLike[], months: Date[]): MonthTotals[] {
  const byKey = new Map<string, MonthTotals>(months.map((month) => [monthKey(month), { key: monthKey(month), month, income: 0, expense: 0 }]))
  for (const t of txs) {
    const row = byKey.get(t.date.slice(0, 7))
    if (!row) continue
    if (t.kind === 'income') row.income += t.cents
    else row.expense += t.cents
  }
  return months.map((m) => byKey.get(monthKey(m))!)
}

export interface CategoryRow {
  /** null na linha "Outras", que junta as categorias menores. */
  id: number | null
  name: string
  cents: number
  /** Parte do total, de 0 a 1. */
  share: number
}

/** Total por categoria, da maior para a menor. O que passar de `top` categorias vira uma linha "Outras". */
export function breakdown(txs: TxLike[], kind: Kind, names: Map<number, string>, top = 6): CategoryRow[] {
  const sums = new Map<number, number>()
  let total = 0
  for (const t of txs) {
    if (t.kind !== kind) continue
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.cents)
    total += t.cents
  }
  if (total === 0) return []

  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const toRow = ([id, cents]: [number, number]): CategoryRow => ({ id, name: names.get(id) ?? 'Sem categoria', cents, share: cents / total })

  // Só agrupa se sobrar mais de uma categoria: uma única "Outras" seria só esconder o nome dela.
  if (sorted.length <= top + 1) return sorted.map(toRow)
  const rest = sorted.slice(top).reduce((sum, [, cents]) => sum + cents, 0)
  return [...sorted.slice(0, top).map(toRow), { id: null, name: 'Outras', cents: rest, share: rest / total }]
}

/** Quanto da receita sobrou, de -∞ a 1 (negativo = gastou mais do que ganhou). null se não houve receita. */
export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? (income - expense) / income : null
}

/**
 * Gasto médio por dia. No mês atual, divide pelos dias já passados; em mês passado, pelos dias do mês;
 * em mês futuro, não há o que calcular.
 */
export function dailyAverage(expense: number, month: Date, now: Date): number {
  const current = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()
  const future = month.getFullYear() > now.getFullYear() || (month.getFullYear() === now.getFullYear() && month.getMonth() > now.getMonth())
  if (future) return 0
  const days = current ? now.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Math.round(expense / days)
}

/** Maior despesa individual do período, ou null se não houve nenhuma. */
export function largestExpense<T extends TxLike>(txs: T[]): T | null {
  let best: T | null = null
  for (const t of txs) if (t.kind === 'expense' && (best === null || t.cents > best.cents)) best = t
  return best
}

/** Escala "redonda" para o eixo: o topo cobre o maior valor, com marcas em 1, 2, 2,5 ou 5 × 10^n. Valores em centavos. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(max, 100) / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
  const top = Math.ceil(Math.max(max, 100) / step) * step
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) }
}

const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Valor curto para o eixo: 250000 -> "2,5 mil", 0 -> "0". Recebe centavos. */
export function formatCompact(cents: number): string {
  return compactFmt.format(cents / 100)
}
