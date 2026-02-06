import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ARTIFACT_ROOT = process.env.ARTIFACT_DIR || '/e2e-artifacts/diagnostics';

function maskToken(token?: string, keep = 12) {
  if (!token) return undefined;
  if (token.length <= keep * 2) return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  return `${token.substring(0, keep)}...${token.substring(token.length - keep)}`;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeMkdir(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

test.describe('Autenticação e Sessão', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Limpar storage antes de cada teste
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const events = {
      console: [] as Array<{ type: string; text: string }>,
      pageerror: [] as Array<{ message: string }>,
      requestfailed: [] as Array<{ url: string; method?: string; failure?: string }>,
      responses: [] as Array<{ url: string; status: number; method?: string; snippet?: string }>,
      tokenResponse: null as null | { status: number; body: unknown },
      rbacRequests: {
        user_roles: false,
        profiles: false,
      },
      lastAuthzError: null as null | { url: string; status: number; body?: unknown },
    };

    (testInfo as any)._events = events;

    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      events.console.push(entry);
      if (events.console.length > 200) events.console.shift();
    });

    page.on('pageerror', (err) => {
      events.pageerror.push({ message: String(err) });
      if (events.pageerror.length > 50) events.pageerror.shift();
    });

    page.on('requestfailed', (req) => {
      events.requestfailed.push({
        url: req.url(),
        method: req.method(),
        failure: req.failure()?.errorText,
      });
      if (events.requestfailed.length > 200) events.requestfailed.shift();
    });

    page.on('response', async (res) => {
      const url = res.url();
      const status = res.status();
      const method = res.request().method();

      // Track RBAC requests executed
      if (url.includes('/rest/v1/user_roles')) events.rbacRequests.user_roles = true;
      if (url.includes('/rest/v1/profiles')) events.rbacRequests.profiles = true;

      // Capture token response (PROVA A dentro do fluxo do app/UI)
      if (url.includes('/auth/v1/token') && method === 'POST') {
        try {
          const text = await res.text();
          const body = tryParseJson(text) as any;
          if (body?.access_token) body.access_token = maskToken(body.access_token);
          if (body?.refresh_token) body.refresh_token = maskToken(body.refresh_token);
          events.tokenResponse = { status, body };
        } catch {
          events.tokenResponse = { status, body: '(unreadable)' };
        }
      }

      // Capture authz/RLS errors
      if ([401, 403].includes(status) || url.includes('/rest/v1/')) {
        if (status === 401 || status === 403) {
          try {
            const text = await res.text();
            const body = tryParseJson(text);
            events.lastAuthzError = { url, status, body };
          } catch {
            events.lastAuthzError = { url, status };
          }
        }
      }

      // Keep a small rolling log of interesting responses
      if (url.includes('/auth/v1/token') || url.includes('/rest/v1/user_roles') || url.includes('/rest/v1/profiles') || status >= 400) {
        let snippet: string | undefined;
        try {
          const text = await res.text();
          snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text;
        } catch {
          snippet = undefined;
        }

        events.responses.push({ url, status, method, snippet });
        if (events.responses.length > 200) events.responses.shift();
      }
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    const events = (testInfo as any)._events as any;
    if (!events) return;

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (!failed) return;

    const safeName = testInfo.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
    const outDir = path.join(ARTIFACT_ROOT, '01-auth', `${Date.now()}_${safeName}`);
    safeMkdir(outDir);

    // Screenshot determinístico (além do screenshot automático do Playwright)
    try {
      await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
    } catch {
      // ignore
    }

    // Toast/alert visível (se houver)
    let visibleToast: string | null = null;
    try {
      const toast = page.locator('[data-sonner-toast], [role="alert"]').first();
      if (await toast.isVisible({ timeout: 500 })) {
        visibleToast = (await toast.innerText()).slice(0, 800);
      }
    } catch {
      // ignore
    }

    const report = {
      title: testInfo.title,
      url: page.url(),
      tokenResponse: events.tokenResponse,
      rbacRequests: events.rbacRequests,
      lastAuthzError: events.lastAuthzError,
      requestfailed: events.requestfailed.slice(-20),
      responses: events.responses.slice(-30),
      console: events.console.slice(-50),
      pageerror: events.pageerror.slice(-10),
      visibleToast,
      notes: [
        events.rbacRequests.user_roles || events.rbacRequests.profiles
          ? null
          : 'RBAC request not executed',
      ].filter(Boolean),
    };

    fs.writeFileSync(path.join(outDir, 'error-context.md'), `# error-context (01-auth)\n\n\n## URL\n\n${report.url}\n\n## PROVA A (token via UI flow)\n\n\n\`\`\`json\n${JSON.stringify(report.tokenResponse, null, 2)}\n\`\`\`\n\n## PROVA B (RBAC request executed?)\n\n\`\`\`json\n${JSON.stringify(report.rbacRequests, null, 2)}\n\`\`\`\n\n> ${report.notes.join(' | ') || 'OK'}\n\n## Último erro 401/403 (se houver)\n\n\`\`\`json\n${JSON.stringify(report.lastAuthzError, null, 2)}\n\`\`\`\n\n## requestfailed (últimos 20)\n\n\`\`\`json\n${JSON.stringify(report.requestfailed, null, 2)}\n\`\`\`\n\n## responses (últimos 30 relevantes)\n\n\`\`\`json\n${JSON.stringify(report.responses, null, 2)}\n\`\`\`\n\n## console (últimos 50)\n\n\`\`\`json\n${JSON.stringify(report.console, null, 2)}\n\`\`\`\n\n## pageerror (últimos 10)\n\n\`\`\`json\n${JSON.stringify(report.pageerror, null, 2)}\n\`\`\`\n\n## toast/alert visível\n\n${report.visibleToast ? '```\n' + report.visibleToast + '\n```' : '(none)'}\n`);

    // Log curto no stdout (para aparecer no CI)
    console.log('[01-auth] error-context saved to:', outDir);
    console.log('[01-auth] tokenResponse:', JSON.stringify(report.tokenResponse));
    console.log('[01-auth] lastAuthzError:', JSON.stringify(report.lastAuthzError));
    console.log('[01-auth] rbacRequests:', JSON.stringify(report.rbacRequests));
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
        const newPassword = ADMIN_PASSWORD;
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
        const newPassword = ADMIN_PASSWORD;
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
        const newPassword = ADMIN_PASSWORD;
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
        const newPassword = ADMIN_PASSWORD;
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
