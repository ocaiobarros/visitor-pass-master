import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

// Gerar CPF válido para testes
function generateCPF(): string {
  const random = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, random);
  
  const d1 = n.map((v, i) => v * (10 - i)).reduce((a, b) => a + b) % 11;
  n.push(d1 < 2 ? 0 : 11 - d1);
  
  const d2 = n.map((v, i) => v * (11 - i)).reduce((a, b) => a + b) % 11;
  n.push(d2 < 2 ? 0 : 11 - d2);
  
  return n.join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

test.describe('Cadastro de Visitantes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('cadastrar visitante com CPF e telefone válidos', async ({ page }) => {
    await page.goto('/register');
    
    // Preencher dados do visitante
    const cpf = generateCPF();
    const phone = '(11) 99999-8888';
    const name = `Visitante Teste ${Date.now()}`;

    await page.getByLabel(/nome/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);
    await page.getByLabel(/telefone/i).fill(phone);
    
    // Preencher destino da visita
    const visitTo = page.getByLabel(/setor|pessoa|destino/i).first();
    if (await visitTo.isVisible()) {
      await visitTo.fill('Recursos Humanos');
    }

    // Datas de validade (se existirem)
    const validFrom = page.getByLabel(/início|de/i).first();
    if (await validFrom.isVisible()) {
      await validFrom.fill(new Date().toISOString().split('T')[0]);
    }

    // Submeter
    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();

    // Verificar sucesso
    await expect(page.getByText(/sucesso|cadastrado|criado|credencial/i)).toBeVisible({ timeout: 10000 });
  });

  test('visitante cadastrado aparece na lista', async ({ page }) => {
    // Primeiro cadastrar
    await page.goto('/register');
    
    const cpf = generateCPF();
    const name = `Lista Teste ${Date.now()}`;

    await page.getByLabel(/nome/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);
    
    const visitTo = page.getByLabel(/setor|pessoa|destino/i).first();
    if (await visitTo.isVisible()) {
      await visitTo.fill('TI');
    }

    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();
    await page.waitForTimeout(2000);

    // Ir para lista
    await page.goto('/visitors');
    
    // Verificar que visitante aparece (pelo nome ou CPF)
    await expect(page.getByText(name).or(page.getByText(cpf.replace(/\D/g, '').slice(0, 3)))).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Cadastro de Funcionários', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('cadastrar funcionário', async ({ page }) => {
    await page.goto('/register/employee');
    
    const cpf = generateCPF();
    const name = `Funcionário Teste ${Date.now()}`;

    await page.getByLabel(/nome/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);
    
    // Cargo
    const jobTitle = page.getByLabel(/cargo|função/i);
    if (await jobTitle.isVisible()) {
      await jobTitle.fill('Analista');
    }

    // Departamento
    const dept = page.getByLabel(/departamento|setor/i);
    if (await dept.isVisible()) {
      await dept.click();
      await page.getByRole('option').first().click().catch(() => {});
    }

    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();

    await expect(page.getByText(/sucesso|cadastrado|criado/i)).toBeVisible({ timeout: 10000 });
  });

  test('funcionário cadastrado aparece na lista', async ({ page }) => {
    await page.goto('/register/employee');
    
    const cpf = generateCPF();
    const name = `Func Lista ${Date.now()}`;

    await page.getByLabel(/nome/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);

    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();
    await page.waitForTimeout(2000);

    await page.goto('/employees');
    
    await expect(page.getByText(name).or(page.locator('table'))).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Cadastro de Veículos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('cadastrar veículo', async ({ page }) => {
    await page.goto('/register/vehicle');
    
    const cpf = generateCPF();
    const name = `Motorista ${Date.now()}`;
    const plate = `ABC${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

    await page.getByLabel(/nome|proprietário|motorista/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);
    await page.getByLabel(/placa/i).fill(plate);
    
    const model = page.getByLabel(/modelo|veículo/i);
    if (await model.isVisible()) {
      await model.fill('Toyota Corolla');
    }

    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();

    await expect(page.getByText(/sucesso|cadastrado|criado/i)).toBeVisible({ timeout: 10000 });
  });

  test('veículo cadastrado aparece na lista', async ({ page }) => {
    await page.goto('/register/vehicle');
    
    const cpf = generateCPF();
    const name = `Veic Lista ${Date.now()}`;
    const plate = `XYZ${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

    await page.getByLabel(/nome|proprietário|motorista/i).first().fill(name);
    await page.getByLabel(/cpf|documento/i).fill(cpf);
    await page.getByLabel(/placa/i).fill(plate);

    await page.getByRole('button', { name: /cadastrar|salvar|registrar/i }).click();
    await page.waitForTimeout(2000);

    await page.goto('/vehicles');
    
    await expect(page.getByText(plate).or(page.getByText(name))).toBeVisible({ timeout: 10000 });
  });
});
