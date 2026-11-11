import Dexie, { type EntityTable } from 'dexie'

export type Kind = 'income' | 'expense'

export interface Category {
  id: number
  name: string
  kind: Kind
}

export interface Account {
  id: number
  name: string
}

export interface Tx {
  id: number
  kind: Kind
  /** Valor em centavos (inteiro, sempre positivo). */
  cents: number
  /** Data local no formato AAAA-MM-DD. */
  date: string
  categoryId: number
  accountId: number
  note: string
}

export const db = new Dexie('controle-financeiro') as Dexie & {
  categories: EntityTable<Category, 'id'>
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Tx, 'id'>
}

db.version(1).stores({
  categories: '++id, kind',
  accounts: '++id',
  transactions: '++id, date, categoryId, accountId',
})

// Categorias e contas iniciais, criadas só na primeira vez que o banco é aberto.
db.on('populate', (tx) => {
  const expense = ['Mercado', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros']
  const income = ['Salário', 'Outras receitas']
  tx.table('categories').bulkAdd([
    ...expense.map((name) => ({ name, kind: 'expense' as const })),
    ...income.map((name) => ({ name, kind: 'income' as const })),
  ])
  tx.table('accounts').bulkAdd([{ name: 'Carteira' }, { name: 'Conta corrente' }])
})
