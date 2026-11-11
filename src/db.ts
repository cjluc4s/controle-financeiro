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

// O Dexie pede essa conversão de tipo para saber quais tabelas existem (padrão da documentação dele).
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const db = new Dexie('controle-financeiro') as Dexie & {
  categories: EntityTable<Category, 'id'>
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Tx, 'id'>
}

// Como mudar a estrutura do banco (nova tabela, novo índice, novo campo):
//  1. NÃO edite a versão abaixo. Acrescente `db.version(2).stores({...})` com só o que mudou e, se for preciso
//     converter dados já gravados, `.upgrade((tx) => ...)`. O Dexie aplica as versões em ordem no aparelho de cada pessoa.
//  2. Se o formato do arquivo de backup mudar, suba o `version` em backup.ts e aceite também o formato antigo
//     (convertendo-o), porque as pessoas guardam backups antigos.
//  3. Mexer em campos obrigatórios exige atualizar também o schema do backup e os testes de src/data.test.ts.
db.version(1).stores({
  categories: '++id, kind',
  accounts: '++id',
  transactions: '++id, date, categoryId, accountId',
})

// Categorias e contas iniciais, criadas só na primeira vez que o banco é aberto.
db.on('populate', (tx) => {
  const expense = ['Mercado', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros']
  const income = ['Salário', 'Outras receitas']
  // Sem await de propósito: dentro do evento 'populate' o Dexie espera a transação terminar por conta própria.
  void tx.table('categories').bulkAdd([...expense.map((name) => ({ name, kind: 'expense' as const })), ...income.map((name) => ({ name, kind: 'income' as const }))])
  void tx.table('accounts').bulkAdd([{ name: 'Carteira' }, { name: 'Conta corrente' }])
})
