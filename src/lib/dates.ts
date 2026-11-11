const pad = (n: number) => String(n).padStart(2, '0')

/** Data local como AAAA-MM-DD (não usa UTC, para não trocar o dia perto da meia-noite). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const shortMonthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

/** "out." -> "Out" (curto, para o eixo dos gráficos). */
export function shortMonth(d: Date): string {
  const label = shortMonthFmt.format(d).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Intervalo [início, fim) do mês, como textos AAAA-MM-DD. */
export function monthRange(d: Date): [string, string] {
  return [toISODate(startOfMonth(d)), toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1))]
}

/** "2026-10-14" -> "14/10" */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86_400_000)
}
