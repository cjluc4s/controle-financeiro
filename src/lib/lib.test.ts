import { describe, expect, it } from 'vitest'
import { daysSince, formatDayMonth, isValidISODate, monthRange, toISODate } from './dates'
import { centsToInput, maskAmount, parseMaskedToCents, parseToCents } from './money'

describe('maskAmount (campo de valor)', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['100', '100'],
    ['1000', '1.000'],
    ['10000', '10.000'],
    ['1234567', '1.234.567'],
    ['1.000', '1.000'],
    ['12,5', '12,5'],
    ['12,50', '12,50'],
    ['12,567', '12,56'],
    ['1000,5', '1.000,5'],
    ['1.000,50', '1.000,50'],
    ['1000.', '1.000,'],
    [',5', '0,5'],
    ['007', '7'],
    ['0000', '0'],
    ['abc', ''],
    ['R$ 15', '15'],
    ['1234567890123', '123.456.789'],
  ])('"%s" vira "%s"', (input, expected) => {
    expect(maskAmount(input)).toBe(expected)
  })

  it('digitar mil reais tecla a tecla mostra os pontos de milhar', () => {
    let shown = ''
    const steps: string[] = []
    for (const key of '1000') {
      shown = maskAmount(shown + key)
      steps.push(shown)
    }
    expect(steps).toEqual(['1', '10', '100', '1.000'])
  })

  it('apagar com backspace depois de formatar continua certo', () => {
    expect(maskAmount('1.00')).toBe('100')
    expect(maskAmount('1.234.56')).toBe('123.456')
  })

  it('o texto formatado volta a ser o mesmo valor em centavos', () => {
    expect(parseMaskedToCents('1.000')).toBe(100000)
    expect(parseMaskedToCents('1.250,75')).toBe(125075)
    expect(parseMaskedToCents('10,')).toBe(1000)
    expect(parseMaskedToCents('0,05')).toBe(5)
    expect(parseMaskedToCents('')).toBeNull()
  })

  it('centsToInput mostra o valor para edição', () => {
    expect(centsToInput(125075)).toBe('1.250,75')
    expect(centsToInput(100000)).toBe('1.000,00')
    expect(centsToInput(5)).toBe('0,05')
  })
})

describe('parseToCents', () => {
  it.each([
    ['12,50', 1250],
    ['1.234,5', 123450],
    ['1.234,56', 123456],
    ['12.5', 1250],
    ['0,29', 29],
    ['1.15', 115],
    ['7', 700],
    ['  89,90 ', 8990],
  ])('converte %s em %i centavos', (input, expected) => {
    expect(parseToCents(input)).toBe(expected)
  })

  it.each(['', 'abc', '12,345', '-5', '1,2,3', 'R$ 10'])('rejeita "%s"', (input) => {
    expect(parseToCents(input)).toBeNull()
  })
})

describe('datas', () => {
  it('monta a data local sem trocar o dia', () => {
    expect(toISODate(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14')
  })

  it('calcula o intervalo do mês, inclusive na virada do ano', () => {
    expect(monthRange(new Date(2026, 9, 20))).toEqual(['2026-10-01', '2026-11-01'])
    expect(monthRange(new Date(2026, 11, 5))).toEqual(['2026-12-01', '2027-01-01'])
  })

  it('formata dia/mês', () => {
    expect(formatDayMonth('2026-10-04')).toBe('04/10')
  })

  it('conta dias desde o último backup', () => {
    const now = new Date(2026, 9, 14, 10, 0)
    expect(daysSince('2026-10-14', now)).toBe(0)
    expect(daysSince('2026-09-14', now)).toBe(30)
    expect(daysSince(null, now)).toBeNull()
  })
})

describe('isValidISODate', () => {
  it.each(['2026-10-08', '2024-02-29', '1900-01-01', '2999-12-31'])('aceita %s', (d) => expect(isValidISODate(d)).toBe(true))
  it.each(['', '2026-2-3', '08/10/2026', '2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '0001-01-01', '3000-01-01', '275760-09-13'])('recusa "%s"', (d) =>
    expect(isValidISODate(d)).toBe(false),
  )
})
