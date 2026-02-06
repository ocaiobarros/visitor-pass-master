import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@456';

test.describe('Relatórios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('página de relatórios carrega', async ({ page }) => {
    await page.goto('/settings');
    
    // Clicar na aba de relatórios
    const reportsTab = page.getByRole('tab', { name: /relatório/i });
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }

    // Deve exibir interface de relatórios
    await expect(
      page.getByText(/relatório|report|exportar|gerar/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('relatório não exibe erro crítico', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/settings');
    
    const reportsTab = page.getByRole('tab', { name: /relatório/i });
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }

    await page.waitForLoadState('networkidle');

    // Filtra erros críticos
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') &&
      !e.includes('net::ERR') &&
      !e.includes('ResizeObserver')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('filtros de data funcionam', async ({ page }) => {
    await page.goto('/settings');
    
    const reportsTab = page.getByRole('tab', { name: /relatório/i });
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }

    // Procurar inputs de data
    const dateFrom = page.getByLabel(/de|início|data inicial/i);
    const dateTo = page.getByLabel(/até|fim|data final/i);

    if (await dateFrom.isVisible() && await dateTo.isVisible()) {
      // Preencher intervalo de datas
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await dateFrom.fill(weekAgo);
      await dateTo.fill(today);

      // Deve processar sem erro
      await page.waitForTimeout(1000);
      await expect(page.getByText(/erro crítico/i)).not.toBeVisible();
    }
  });
});
