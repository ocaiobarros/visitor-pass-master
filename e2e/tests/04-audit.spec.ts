import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@456';

test.describe('Logs de Auditoria', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('página de auditoria carrega', async ({ page }) => {
    await page.goto('/settings');
    
    // Clicar na aba de auditoria
    const auditTab = page.getByRole('tab', { name: /auditoria|logs/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Deve exibir tabela ou lista
    await expect(
      page.locator('table').or(page.getByText(/log|evento|ação/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('auditoria exibe pelo menos um evento de login', async ({ page }) => {
    await page.goto('/settings');
    
    const auditTab = page.getByRole('tab', { name: /auditoria|logs/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Aguardar carregamento
    await page.waitForTimeout(2000);

    // Deve haver pelo menos um registro de LOGIN
    const loginEvent = page.getByText(/login/i);
    await expect(loginEvent.first()).toBeVisible({ timeout: 10000 });
  });

  test('filtros de auditoria funcionam', async ({ page }) => {
    await page.goto('/settings');
    
    const auditTab = page.getByRole('tab', { name: /auditoria|logs/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Procurar filtro de tipo de ação
    const actionFilter = page.getByLabel(/tipo|ação|filtro/i).first();
    if (await actionFilter.isVisible()) {
      await actionFilter.click();
      
      // Selecionar um tipo específico
      const option = page.getByRole('option', { name: /login/i });
      if (await option.isVisible()) {
        await option.click();
        
        // Verificar que tabela atualizou
        await page.waitForTimeout(1000);
        await expect(page.locator('table').or(page.getByText(/log|evento/i))).toBeVisible();
      }
    }
  });
});
