// Data (AAAA-MM-DD) do último backup, guardada no aparelho para o aviso "faz X dias do último backup".
// Fica fora de backup.ts de propósito: o aviso é usado na tela inicial, e backup.ts carrega o zod.
const LAST_BACKUP_KEY = 'lastBackup'

export function getLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

export function setLastBackup(iso: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso)
  } catch {
    /* sem armazenamento: o aviso de backup só fica menos preciso */
  }
}
