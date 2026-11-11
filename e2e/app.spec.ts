import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function addExpense(page: Page, value: string, note: string) {
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Valor').fill(value)
  await dialog.getByPlaceholder('Descrição (opcional)').fill(note)
  await dialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Nenhum lançamento neste mês')).toBeVisible()
})

test('cria, edita e exclui um lançamento', async ({ page }) => {
  await addExpense(page, '45,90', 'Padaria')
  await page.getByRole('button', { name: 'Extrato' }).click()
  const row = page.getByRole('button', { name: /Padaria/ })
  await expect(row).toContainText('45,90')

  await row.click()
  await page.getByLabel('Valor').fill('50')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('button', { name: /Padaria/ })).toContainText('50,00')

  await page.getByRole('button', { name: /Padaria/ }).click()
  await page.getByRole('button', { name: /Excluir lançamento/ }).click()
  await page.getByRole('button', { name: /Confirmar exclusão/ }).click()
  await expect(page.getByRole('button', { name: /Padaria/ })).toHaveCount(0)
  await expect(page.getByText('Nenhum lançamento neste mês')).toBeVisible()
})

test('o botão Voltar fecha a folha e navega pelas abas', async ({ page }) => {
  await page.getByRole('button', { name: 'Extrato' }).click()
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/#\/extrato$/)

  await page.goBack()
  await expect(page.getByRole('button', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
})

test('recarregar mantém a aba aberta', async ({ page }) => {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Backup' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Backup' })).toBeVisible()
})

test('o tema escolhido já vale no primeiro desenho, sem piscar o tema errado', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' })
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark')
    // Registra o tema assim que o HTML termina de ser lido, antes de o app (módulo) montar a tela.
    document.addEventListener('DOMContentLoaded', () => {
      Object.assign(window, { themeAtLoad: document.documentElement.getAttribute('data-theme') })
    })
  })
  await page.goto('/')
  await expect(page.getByText('Nenhum lançamento neste mês')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'themeAtLoad'))).toBe('dark')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 21, 20)')
  await context.close()
})

test('exporta um backup e importa de volta, guardando uma cópia dos dados atuais', async ({ page }) => {
  await addExpense(page, '12,34', 'Café')
  await page.getByRole('button', { name: 'Ajustes' }).click()

  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar' }).click()
  const backupPath = await (await exported).path()
  const backup: { transactions: { cents: number; note: string }[] } = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.transactions).toHaveLength(1)
  expect(backup.transactions[0]).toMatchObject({ cents: 1234, note: 'Café' })

  // Muda os dados e importa o backup: o app confirma, guarda uma cópia (2º download) e restaura.
  await page.getByRole('button', { name: 'Início' }).click()
  await addExpense(page, '99', 'Para sumir')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('salvar uma cópia dos dados atuais')
    void dialog.accept()
  })
  const safetyCopy = page.waitForEvent('download')
  await page.locator('input[type=file]').setInputFiles(backupPath)
  expect((await safetyCopy).suggestedFilename()).toMatch(/^financas-backup-.*\.json$/)
  await expect(page.getByRole('status')).toContainText('Backup importado: 1 lançamento.')

  await page.getByRole('button', { name: 'Extrato' }).click()
  await expect(page.getByRole('button', { name: /Café/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Para sumir/ })).toHaveCount(0)
})

test.describe('responsividade', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`sem rolagem lateral e com o botão + visível em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await addExpense(page, '10', 'Teste')
      for (const tab of ['Início', 'Extrato', 'Relatórios', 'Ajustes']) {
        await page.getByRole('button', { name: tab }).click()
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `rolagem lateral na aba ${tab}`).toBeLessThanOrEqual(0)
        await expect(page.getByRole('button', { name: 'Novo lançamento' }).last()).toBeInViewport()
      }
      await page.getByRole('button', { name: 'Novo lançamento' }).last().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width)
    })
  }
})
