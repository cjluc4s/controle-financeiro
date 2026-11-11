import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

const valid = {
  app: 'controle-financeiro',
  version: 1,
  exportedAt: '2026-10-14T12:00:00.000Z',
  categories: [{ id: 1, name: 'Mercado', kind: 'expense' }],
  accounts: [{ id: 1, name: 'Carteira' }],
  transactions: [{ id: 1, kind: 'expense', cents: 4235, date: '2026-10-08', categoryId: 1, accountId: 1, note: 'Compras' }],
}

describe('parseBackup', () => {
  it('aceita um backup válido', () => {
    const result = parseBackup(JSON.stringify(valid))
    expect(result.ok).toBe(true)
  })

  it('rejeita texto que não é JSON', () => {
    expect(parseBackup('isto não é json')).toMatchObject({ ok: false })
  })

  it('rejeita JSON de outro app', () => {
    expect(parseBackup(JSON.stringify({ foo: 'bar' }))).toMatchObject({ ok: false })
  })

  it('rejeita valores quebrados (centavos negativos ou com vírgula)', () => {
    for (const cents of [-1, 0, 10.5]) {
      const bad = { ...valid, transactions: [{ ...valid.transactions[0], cents }] }
      expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
    }
  })

  it('rejeita data fora do formato AAAA-MM-DD', () => {
    const bad = { ...valid, transactions: [{ ...valid.transactions[0], date: '08/10/2026' }] }
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
  })

  it('rejeita lançamento ligado a categoria ou conta que não existe', () => {
    const noCategory = { ...valid, transactions: [{ ...valid.transactions[0], categoryId: 99 }] }
    const noAccount = { ...valid, transactions: [{ ...valid.transactions[0], accountId: 99 }] }
    expect(parseBackup(JSON.stringify(noCategory))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify(noAccount))).toMatchObject({ ok: false })
  })

  it('rejeita data que não existe no calendário', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '0001-01-01']) {
      const bad = { ...valid, transactions: [{ ...valid.transactions[0], date }] }
      expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
    }
  })

  it('rejeita valor acima do máximo e textos grandes demais', () => {
    const huge = { ...valid, transactions: [{ ...valid.transactions[0], cents: 10 ** 12 }] }
    const longNote = { ...valid, transactions: [{ ...valid.transactions[0], note: 'x'.repeat(81) }] }
    const longName = { ...valid, categories: [{ ...valid.categories[0], name: 'x'.repeat(31) }] }
    for (const bad of [huge, longNote, longName]) expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
  })

  it('rejeita identificadores repetidos', () => {
    const dupTx = { ...valid, transactions: [valid.transactions[0], { ...valid.transactions[0] }] }
    const dupCategory = { ...valid, categories: [valid.categories[0], { ...valid.categories[0], name: 'Outra' }] }
    expect(parseBackup(JSON.stringify(dupTx))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify(dupCategory))).toMatchObject({ ok: false })
  })

  it('rejeita lançamento de receita ligado a categoria de despesa', () => {
    const bad = { ...valid, transactions: [{ ...valid.transactions[0], kind: 'income' }] }
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
  })

  it('diferencia "outro app" de "backup com valores inválidos" na mensagem', () => {
    const other = parseBackup(JSON.stringify({ foo: 1 }))
    const broken = parseBackup(JSON.stringify({ ...valid, transactions: [{ ...valid.transactions[0], cents: -1 }] }))
    expect(other).toMatchObject({ ok: false, error: expect.stringMatching(/não parece ser um backup/) })
    expect(broken).toMatchObject({ ok: false, error: expect.stringMatching(/valores inválidos/) })
  })
})
