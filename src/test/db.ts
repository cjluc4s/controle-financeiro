import { db } from '../db'

/** Recria o banco do zero (com as categorias e contas iniciais). Use em `beforeEach`. */
export async function resetDb() {
  await db.delete()
  await db.open()
}
