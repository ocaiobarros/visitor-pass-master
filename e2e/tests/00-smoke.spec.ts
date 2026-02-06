import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('página de login carrega corretamente', async ({ page }) => {
    await page.goto('/login');
    
    // Verifica que não é tela branca
    await expect(page.locator('body')).not.toBeEmpty();
    
    // Verifica elementos essenciais do login
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('API de autenticação responde', async ({ request }) => {
    const response = await request.get('/auth/v1/health');
    // GoTrue retorna 200 no health check
    expect([200, 404]).toContain(response.status());
  });

  test('API REST responde', async ({ request }) => {
    const response = await request.get('/rest/v1/', {
      headers: {
        'apikey': process.env.ANON_KEY || '',
      }
    });
    // PostgREST retorna 200 na raiz
    expect([200, 401]).toContain(response.status());
  });

  test('aplicação não exibe erros críticos no console', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Filtra erros esperados (favicon, etc)
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') &&
      !e.includes('net::ERR')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
