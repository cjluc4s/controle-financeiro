const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Valores são guardados em centavos (inteiros) para evitar erro de arredondamento. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100)
}

/**
 * Converte texto digitado em centavos. Retorna null se inválido.
 * Aceita "12,50" e "1.234,5" (vírgula = decimal, ponto = milhar) e também "12.5" (sem vírgula, ponto = decimal).
 */
export function parseToCents(input: string): number | null {
  const text = input.trim()
  const clean = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

const MAX_INT_DIGITS = 9

/** Maior valor aceito em um lançamento, em centavos (999.999.999,99): o que o campo de valor consegue digitar. */
export const MAX_CENTS = 10 ** (MAX_INT_DIGITS + 2) - 1

/**
 * Formata o que a pessoa digita no campo de valor, enquanto digita: "1000" -> "1.000", "1234,5" -> "1.234,5".
 * Vírgula = decimal (até 2 casas). Um ponto digitado no fim, sem vírgula ainda, vira vírgula
 * (teclados que só mostram ponto). Os pontos de milhar são sempre inseridos por aqui.
 */
export function maskAmount(input: string): string {
  let s = input.replace(/[^\d.,]/g, '')
  if (!s.includes(',') && s.endsWith('.')) s = `${s.slice(0, -1)},`

  const comma = s.indexOf(',')
  const intRaw = (comma === -1 ? s : s.slice(0, comma)).replace(/\D/g, '').slice(0, MAX_INT_DIGITS)
  const decimals = comma === -1 ? null : s.slice(comma + 1).replace(/\D/g, '').slice(0, 2)

  const intDigits = intRaw.replace(/^0+(?=\d)/, '')
  const intPart = (intDigits === '' && decimals !== null ? '0' : intDigits).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimals === null ? intPart : `${intPart},${decimals}`
}

/** Converte o texto já formatado por maskAmount ("1.234,56") em centavos. Null se vazio ou inválido. */
export function parseMaskedToCents(masked: string): number | null {
  return parseToCents(masked.replace(/\./g, '').replace(/,$/, ''))
}

/** Valor em centavos como texto para o campo de edição: 125075 -> "1.250,75". */
export function centsToInput(cents: number): string {
  const reais = Math.floor(cents / 100)
  const rest = String(cents % 100).padStart(2, '0')
  return maskAmount(`${reais},${rest}`)
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export function formatMonth(date: Date): string {
  const label = monthFmt.format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
