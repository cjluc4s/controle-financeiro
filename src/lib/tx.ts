import type { Tx } from '../db'

/** Ordem do extrato: data mais recente primeiro; no mesmo dia, o lançamento criado por último. */
export const newestFirst = (a: Pick<Tx, 'date' | 'id'>, b: Pick<Tx, 'date' | 'id'>) => b.date.localeCompare(a.date) || b.id - a.id

/** id -> nome, para mostrar o nome de categorias e contas. */
export const nameMap = (items: { id: number; name: string }[]) => new Map(items.map((i) => [i.id, i.name]))
