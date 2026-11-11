import { describe, expect, it } from 'vitest'
import { breakdown, dailyAverage, largestExpense, lastMonths, monthKey, niceScale, savingsRate, totalsByMonth, type TxLike } from './reports'

const tx = (kind: TxLike['kind'], cents: number, date: string, categoryId = 1): TxLike => ({ kind, cents, date, categoryId })

describe('lastMonths', () => {
  it('lista do mais antigo ao mais novo, inclusive na virada do ano', () => {
    const keys = lastMonths(new Date(2026, 1, 20), 4).map(monthKey)
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('totalsByMonth', () => {
  const months = lastMonths(new Date(2026, 9, 14), 3) // ago, set, out
  it('soma receitas e despesas por mês e zera os meses sem lançamento', () => {
    const rows = totalsByMonth(
      [tx('income', 500000, '2026-10-05'), tx('expense', 10000, '2026-10-06'), tx('expense', 2550, '2026-10-30'), tx('expense', 7000, '2026-08-01')],
      months,
    )
    expect(rows.map((r) => [r.key, r.income, r.expense])).toEqual([
      ['2026-08', 0, 7000],
      ['2026-09', 0, 0],
      ['2026-10', 500000, 12550],
    ])
  })

  it('ignora lançamentos fora da janela', () => {
    const rows = totalsByMonth([tx('expense', 999, '2025-01-01'), tx('expense', 999, '2026-11-01')], months)
    expect(rows.every((r) => r.income === 0 && r.expense === 0)).toBe(true)
  })
})

describe('breakdown', () => {
  const names = new Map([
    [1, 'Mercado'],
    [2, 'Moradia'],
    [3, 'Lazer'],
  ])

  it('ordena da maior para a menor e calcula a parte de cada uma', () => {
    const rows = breakdown([tx('expense', 300, '2026-10-01', 1), tx('expense', 700, '2026-10-02', 2), tx('expense', 100, '2026-10-03', 1)], 'expense', names)
    expect(rows.map((r) => [r.name, r.cents])).toEqual([
      ['Moradia', 700],
      ['Mercado', 400],
    ])
    expect(rows[0].share).toBeCloseTo(700 / 1100)
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1)
  })

  it('considera só o tipo pedido', () => {
    const rows = breakdown([tx('income', 900, '2026-10-01', 3), tx('expense', 100, '2026-10-01', 1)], 'income', names)
    expect(rows).toEqual([{ id: 3, name: 'Lazer', cents: 900, share: 1 }])
  })

  it('junta o que passa do limite em "Outras", mas só se sobrar mais de uma categoria', () => {
    const many = [1, 2, 3, 4, 5].map((id) => tx('expense', 1000 - id * 100, '2026-10-01', id)) // 900, 800, 700, 600, 500
    const grouped = breakdown(many, 'expense', names, 3)
    expect(grouped.map((r) => r.name)).toEqual(['Mercado', 'Moradia', 'Lazer', 'Outras'])
    expect(grouped[3]).toMatchObject({ id: null, cents: 1100 })

    const justOver = breakdown(many.slice(0, 4), 'expense', names, 3)
    expect(justOver).toHaveLength(4)
    expect(justOver.some((r) => r.name === 'Outras')).toBe(false)
  })

  it('usa "Sem categoria" quando a categoria foi apagada e devolve vazio sem dados', () => {
    expect(breakdown([tx('expense', 100, '2026-10-01', 99)], 'expense', names)[0].name).toBe('Sem categoria')
    expect(breakdown([], 'expense', names)).toEqual([])
  })
})

describe('savingsRate', () => {
  it('calcula a fração da receita que sobrou', () => {
    expect(savingsRate(500000, 400000)).toBeCloseTo(0.2)
    expect(savingsRate(500000, 600000)).toBeCloseTo(-0.2)
  })
  it('é null sem receita', () => {
    expect(savingsRate(0, 1000)).toBeNull()
  })
})

describe('dailyAverage', () => {
  const now = new Date(2026, 9, 10) // 10 de outubro
  it('mês atual: divide pelos dias já passados', () => {
    expect(dailyAverage(50000, new Date(2026, 9, 1), now)).toBe(5000)
  })
  it('mês passado: divide pelos dias do mês (setembro tem 30)', () => {
    expect(dailyAverage(60000, new Date(2026, 8, 1), now)).toBe(2000)
  })
  it('mês futuro: zero', () => {
    expect(dailyAverage(1000, new Date(2026, 10, 1), now)).toBe(0)
  })
})

describe('largestExpense', () => {
  it('acha a maior despesa e ignora receitas', () => {
    const list = [tx('income', 900000, '2026-10-01'), tx('expense', 300, '2026-10-02'), tx('expense', 800, '2026-10-03')]
    expect(largestExpense(list)?.cents).toBe(800)
  })
  it('é null sem despesas', () => {
    expect(largestExpense([tx('income', 1, '2026-10-01')])).toBeNull()
  })
})

describe('niceScale', () => {
  it('escolhe marcas redondas que cobrem o maior valor', () => {
    for (const max of [100, 4_235, 123_456, 520_000, 999_999, 12_345_678]) {
      const { top, ticks } = niceScale(max)
      expect(top).toBeGreaterThanOrEqual(max)
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)).toBe(top)
      expect(ticks.length).toBeGreaterThanOrEqual(3)
      expect(ticks.length).toBeLessThanOrEqual(6)
    }
  })
  it('para um máximo de R$ 5.200 o eixo vai até R$ 6.000, de R$ 2.000 em R$ 2.000', () => {
    expect(niceScale(520_000)).toEqual({ top: 600_000, ticks: [0, 200_000, 400_000, 600_000] })
  })
  it('sem valores ainda desenha um eixo', () => {
    const { top, ticks } = niceScale(0)
    expect(top).toBeGreaterThan(0)
    expect(ticks.length).toBeGreaterThan(1)
  })
})
