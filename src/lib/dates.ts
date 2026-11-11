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
  if (y === undefined || m === undefined || d === undefined) return null
  const then = new Date(y, m - 1, d)
  if (Number.isNaN(then.getTime())) return null // texto que não é data (valor corrompido no aparelho)
  return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86_400_000)
}

const MIN_YEAR = 1900
const MAX_YEAR = 2999

/** true só para datas AAAA-MM-DD que existem no calendário ("2026-02-30" e "2026-13-01" são inválidas). */
export function isValidISODate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < MIN_YEAR || y > MAX_YEAR) return false
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}
