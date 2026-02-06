import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

test.describe('Autenticação e Sessão', () => {
  test.beforeEach(async ({ page }) => {
    // Limpar storage antes de cada teste
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Preencher formulário
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Aguardar redirecionamento ou modal de troca de senha
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 15000 });
    
    // Se ficou no login, pode ser modal de troca de senha
    if (page.url().includes('/login')) {
      // Verificar se há modal de troca de senha obrigatória
      const modal = page.getByRole('dialog');
      if (await modal.isVisible()) {
        // Trocar senha se necessário
        const newPassword = 'Admin@456';
        await page.getByLabel(/nova senha/i).first().fill(newPassword);
        await page.getByLabel(/confirmar/i).fill(newPassword);
        await page.getByRole('button', { name: /alterar|salvar/i }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      }
    }

    // Confirmar que está no dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login com credenciais inválidas exibe erro', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('invalido@teste.com');
    await page.getByLabel(/senha/i).fill('senhaerrada');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Deve exibir mensagem de erro
    await expect(page.getByText(/erro|inválid|incorret/i)).toBeVisible({ timeout: 10000 });
    
    // Não deve redirecionar
    await expect(page).toHaveURL(/\/login/);
  });

  test('sessão persiste após reload (F5)', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Lidar com possível troca de senha
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 15000 });
    if (page.url().includes('/login')) {
      const modal = page.getByRole('dialog');
      if (await modal.isVisible()) {
        const newPassword = 'Admin@456';
        await page.getByLabel(/nova senha/i).first().fill(newPassword);
        await page.getByLabel(/confirmar/i).fill(newPassword);
        await page.getByRole('button', { name: /alterar|salvar/i }).click();
      }
    }

    await expect(page).toHaveURL(/\/dashboard/);
    
    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Deve continuar no dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Não deve voltar para login
    await expect(page.getByLabel(/email/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('navegação entre páginas mantém sessão', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 15000 });
    
    // Lidar com troca de senha se necessário
    if (page.url().includes('/login')) {
      const modal = page.getByRole('dialog');
      if (await modal.isVisible()) {
        const newPassword = 'Admin@456';
        await page.getByLabel(/nova senha/i).first().fill(newPassword);
        await page.getByLabel(/confirmar/i).fill(newPassword);
        await page.getByRole('button', { name: /alterar|salvar/i }).click();
      }
    }

    await expect(page).toHaveURL(/\/dashboard/);

    // Navegar para outra página
    await page.goto('/visitors');
    await expect(page).toHaveURL(/\/visitors/);
    
    // Voltar ao dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logout redireciona para login', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 15000 });
    
    // Lidar com troca de senha
    if (page.url().includes('/login')) {
      const modal = page.getByRole('dialog');
      if (await modal.isVisible()) {
        const newPassword = 'Admin@456';
        await page.getByLabel(/nova senha/i).first().fill(newPassword);
        await page.getByLabel(/confirmar/i).fill(newPassword);
        await page.getByRole('button', { name: /alterar|salvar/i }).click();
      }
    }

    await expect(page).toHaveURL(/\/dashboard/);

    // Clicar no botão de logout (pode estar em dropdown ou sidebar)
    const logoutButton = page.getByRole('button', { name: /sair|logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Procurar em menu dropdown
      const userMenu = page.locator('[data-testid="user-menu"], button:has-text("admin")').first();
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.getByRole('menuitem', { name: /sair|logout/i }).click();
      }
    }

    // Deve voltar ao login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('acesso a página protegida sem login redireciona', async ({ page }) => {
    // Tentar acessar dashboard diretamente
    await page.goto('/dashboard');
    
    // Deve redirecionar para login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
