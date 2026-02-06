/**
 * ============================================
 * GUARDA OPERACIONAL - Seed Admin Idempotente
 * ============================================
 * 
 * Script determinístico para criar/reparar o usuário admin.
 * Cópia do script em scripts/seed-admin.ts para uso no container E2E.
 * 
 * Requisitos:
 *   - SERVICE_ROLE_KEY (JWT válido)
 *   - ADMIN_EMAIL
 *   - ADMIN_PASSWORD
 *   - SUPABASE_URL ou API_URL
 * 
 * Uso:
 *   npx ts-node scripts/seed-admin.ts
 * 
 * ============================================
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// Configuração via ENV
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.API_URL || 'http://localhost:8000';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Cores para output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

function log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
  const colors = { info: NC, warn: YELLOW, error: RED, success: GREEN };
  const prefix = { info: '→', warn: '⚠', error: '✗', success: '✓' };
  console.log(`${colors[level]}${prefix[level]} ${message}${NC}`);
}

// ============================================
// Validação de ENVs (fail-fast)
// ============================================
function validateEnvironment(): void {
  const missing: string[] = [];
  
  if (!SERVICE_ROLE_KEY) missing.push('SERVICE_ROLE_KEY');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  
  if (missing.length > 0) {
    log('error', `Variáveis de ambiente ausentes: ${missing.join(', ')}`);
    log('error', 'Abortando seed-admin.ts');
    process.exit(1);
  }
  
  // Validar que SERVICE_ROLE_KEY é JWT (3 partes)
  const jwtParts = SERVICE_ROLE_KEY.split('.');
  if (jwtParts.length !== 3) {
    log('error', 'SERVICE_ROLE_KEY não é um JWT válido (deve ter 3 partes separadas por ".")');
    log('error', 'Gere as chaves com: ./generate-keys.sh');
    process.exit(1);
  }
  
  log('success', 'Variáveis de ambiente validadas');
}

// ============================================
// Cliente Supabase Admin
// ============================================
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================
// Funções de Reparo
// ============================================

interface AuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
}

async function findAdminUser(): Promise<AuthUser | null> {
  log('info', `Buscando usuário: ${ADMIN_EMAIL}`);
  
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  
  if (error) {
    log('error', `Erro ao listar usuários: ${error.message}`);
    return null;
  }
  
  const user = data.users.find(u => 
    u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
  
  return user ? {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
  } : null;
}

async function createAdminUser(): Promise<AuthUser | null> {
  log('info', `Criando usuário admin: ${ADMIN_EMAIL}`);
  
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Administrador' },
  });
  
  if (error) {
    // Se já existe, não é erro
    if (error.message.includes('already') || error.message.includes('exists')) {
      log('warn', 'Usuário já existe, buscando...');
      return findAdminUser();
    }
    log('error', `Erro ao criar usuário: ${error.message}`);
    return null;
  }
  
  log('success', 'Usuário admin criado');
  return data.user ? {
    id: data.user.id,
    email: data.user.email,
    email_confirmed_at: data.user.email_confirmed_at,
  } : null;
}

async function confirmEmail(userId: string): Promise<boolean> {
  log('info', 'Confirmando email do admin...');
  
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  
  if (error) {
    log('error', `Erro ao confirmar email: ${error.message}`);
    return false;
  }
  
  log('success', 'Email confirmado');
  return true;
}

async function resetPassword(userId: string): Promise<boolean> {
  log('info', 'Resetando senha do admin para valor da ENV...');
  
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: ADMIN_PASSWORD,
  });
  
  if (error) {
    log('error', `Erro ao resetar senha: ${error.message}`);
    return false;
  }
  
  log('success', 'Senha resetada para ADMIN_PASSWORD');
  return true;
}

async function upsertUserRole(userId: string): Promise<boolean> {
  log('info', 'Verificando role admin em user_roles...');
  
  // Verificar se tabela user_roles existe e se já tem role
  const { data: existingRole, error: selectError } = await supabaseAdmin
    .from('user_roles')
    .select('id, role')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (selectError && !selectError.message.includes('does not exist')) {
    log('warn', `Erro ao verificar role: ${selectError.message}`);
  }
  
  if (existingRole?.role === 'admin') {
    log('success', 'Role admin já existe');
    return true;
  }
  
  // UPSERT role admin
  const { error: upsertError } = await supabaseAdmin
    .from('user_roles')
    .upsert({
      user_id: userId,
      role: 'admin',
    }, { 
      onConflict: 'user_id',
    });
  
  if (upsertError) {
    // Tentar insert se upsert falhar
    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin',
      });
    
    if (insertError && !insertError.message.includes('duplicate')) {
      log('error', `Erro ao inserir role: ${insertError.message}`);
      return false;
    }
  }
  
  log('success', 'Role admin garantida');
  return true;
}

async function upsertProfile(userId: string): Promise<boolean> {
  log('info', 'Verificando profile do admin...');
  
  // Verificar se profile existe
  const { data: existingProfile, error: selectError } = await supabaseAdmin
    .from('profiles')
    .select('id, is_active, must_change_password')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (selectError && !selectError.message.includes('does not exist')) {
    log('warn', `Erro ao verificar profile: ${selectError.message}`);
  }
  
  // Dados do profile
  const profileData: Record<string, unknown> = {
    user_id: userId,
    full_name: 'Administrador',
    is_active: true,
    must_change_password: false,
  };
  
  if (existingProfile) {
    // Update se precisar
    if (existingProfile.is_active === true && existingProfile.must_change_password === false) {
      log('success', 'Profile já está correto');
      return true;
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active: true,
        must_change_password: false,
      })
      .eq('user_id', userId);
    
    if (updateError) {
      log('error', `Erro ao atualizar profile: ${updateError.message}`);
      return false;
    }
  } else {
    // Insert novo profile
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData);
    
    if (insertError && !insertError.message.includes('duplicate')) {
      log('error', `Erro ao inserir profile: ${insertError.message}`);
      return false;
    }
  }
  
  log('success', 'Profile garantido (is_active=true, must_change_password=false)');
  return true;
}

// ============================================
// Verificação de Login (teste de senha)
// ============================================
async function testLogin(): Promise<boolean> {
  log('info', 'Testando login com credenciais...');
  
  try {
    // Criar cliente anon para teste de login
    const ANON_KEY = process.env.ANON_KEY || process.env.SUPABASE_ANON_KEY || SERVICE_ROLE_KEY;
    const testClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    const { data, error } = await testClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    
    if (error) {
      log('warn', `Login falhou: ${error.message}`);
      return false;
    }
    
    if (data.session) {
      log('success', 'Login bem-sucedido!');
      // Fazer logout
      await testClient.auth.signOut();
      return true;
    }
    
    return false;
  } catch (err) {
    log('warn', `Erro no teste de login: ${err}`);
    return false;
  }
}

// ============================================
// Main
// ============================================
async function main(): Promise<void> {
  console.log('');
  console.log('============================================');
  console.log('  GUARDA OPERACIONAL - Seed Admin');
  console.log('============================================');
  console.log('');
  
  validateEnvironment();
  
  console.log('');
  log('info', `SUPABASE_URL: ${SUPABASE_URL}`);
  log('info', `ADMIN_EMAIL: ${ADMIN_EMAIL}`);
  console.log('');
  
  // 1. Buscar ou criar usuário
  let adminUser = await findAdminUser();
  
  if (!adminUser) {
    adminUser = await createAdminUser();
    if (!adminUser) {
      log('error', 'Falha crítica: não foi possível criar admin');
      process.exit(1);
    }
  } else {
    log('success', `Admin encontrado: ${adminUser.id}`);
  }
  
  // 2. Confirmar email se necessário
  if (!adminUser.email_confirmed_at) {
    const confirmed = await confirmEmail(adminUser.id);
    if (!confirmed) {
      log('error', 'Falha ao confirmar email');
      process.exit(1);
    }
  } else {
    log('success', 'Email já confirmado');
  }
  
  // 3. Testar login - se falhar, resetar senha
  const loginWorks = await testLogin();
  if (!loginWorks) {
    log('warn', 'Senha diverge da ENV, resetando...');
    const reset = await resetPassword(adminUser.id);
    if (!reset) {
      log('error', 'Falha ao resetar senha');
      process.exit(1);
    }
    
    // Testar novamente
    const retryLogin = await testLogin();
    if (!retryLogin) {
      log('error', 'Login ainda falha após reset de senha');
      process.exit(1);
    }
  }
  
  // 4. Garantir role admin
  const roleOk = await upsertUserRole(adminUser.id);
  if (!roleOk) {
    log('error', 'Falha ao garantir role admin');
    process.exit(1);
  }
  
  // 5. Garantir profile
  const profileOk = await upsertProfile(adminUser.id);
  if (!profileOk) {
    log('error', 'Falha ao garantir profile');
    process.exit(1);
  }
  
  console.log('');
  console.log('============================================');
  log('success', 'SEED ADMIN COMPLETO');
  console.log('============================================');
  console.log('');
  console.log(`  ID: ${adminUser.id}`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Role: admin`);
  console.log(`  Status: ativo, email confirmado`);
  console.log('');
  
  process.exit(0);
}

main().catch(err => {
  log('error', `Erro fatal: ${err}`);
  process.exit(1);
});
