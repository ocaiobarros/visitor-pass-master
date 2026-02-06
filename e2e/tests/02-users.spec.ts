import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

test.describe('Gerenciamento de Usuários', () => {
  test.beforeEach(async ({ page }) => {
    // Login como admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Aguardar dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('admin consegue acessar configurações de usuários', async ({ page }) => {
    // Navegar para configurações
    await page.goto('/settings');
    
    // Clicar na aba de usuários
    const usersTab = page.getByRole('tab', { name: /usuários/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
    }

    // Deve exibir lista ou formulário de usuários
    await expect(page.getByText(/usuário|gerenci|admin/i)).toBeVisible({ timeout: 5000 });
  });

  test('criar usuário RH não troca sessão do admin', async ({ page }) => {
    // Capturar ID do admin antes
    const adminIdBefore = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => /sb-.*-auth-token/.test(k)) || '';
      const storage = key ? localStorage.getItem(key) : null;
      if (storage) {
        const data = JSON.parse(storage);
        return data?.user?.id || null;
      }
      return null;
    });

    // Navegar para configurações
    await page.goto('/settings');
    
    // Clicar na aba de usuários
    const usersTab = page.getByRole('tab', { name: /usuários/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
    }

    // Clicar em novo usuário
    const newUserBtn = page.getByRole('button', { name: /novo|adicionar|criar/i });
    if (await newUserBtn.isVisible()) {
      await newUserBtn.click();
    }

    // Preencher formulário de criação
    const uniqueEmail = `rh.teste.${Date.now()}@sistema.local`;
    
    await page.getByLabel(/nome/i).first().fill('Teste RH');
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/senha/i).first().fill('RH@12345');
    
    // Selecionar perfil RH
    const roleSelect = page.getByLabel(/perfil|papel|role/i);
    if (await roleSelect.isVisible()) {
      await roleSelect.click();
      await page.getByRole('option', { name: /rh/i }).click();
    }

    // Submeter
    await page.getByRole('button', { name: /criar|salvar|cadastrar/i }).click();

    // Aguardar resposta
    await page.waitForTimeout(2000);

    // Verificar que admin continua logado (mesmo ID)
    const adminIdAfter = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => /sb-.*-auth-token/.test(k)) || '';
      const storage = key ? localStorage.getItem(key) : null;
      if (storage) {
        const data = JSON.parse(storage);
        return data?.user?.id || null;
      }
      return null;
    });

    // IDs devem ser iguais (sessão não trocou)
    if (adminIdBefore && adminIdAfter) {
      expect(adminIdAfter).toBe(adminIdBefore);
    }

    // Deve exibir mensagem de sucesso ou usuário na lista
    const success = page.getByText(/sucesso|criado|cadastrado/i);
    const userInList = page.getByText(uniqueEmail);
    
    await expect(success.or(userInList)).toBeVisible({ timeout: 10000 });
  });
});
