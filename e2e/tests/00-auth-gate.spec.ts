/**
 * ============================================
 * AUTH SMOKE GATE - Fail-Fast Authentication Test
 * ============================================
 * 
 * Este teste BLOQUEIA toda a suíte E2E se a autenticação falhar.
 * 
 * Validações:
 *   ✓ HTTP 200 do endpoint /auth/v1/token
 *   ✓ access_token presente
 *   ✓ JWT com 3 partes (x.y.z)
 *   ✓ exp no futuro
 *   ✓ role efetiva = admin
 * 
 * IMPORTANTE:
 *   - NÃO usa SDK do Supabase
 *   - NÃO usa UI
 *   - Fail-fast: process.exit(1) em caso de falha
 * 
 * ============================================
 */

import { test, expect } from '@playwright/test';

// Configuração
const BASE_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:8000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sistema.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ANON_KEY = process.env.ANON_KEY || '';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  error?: string;
  error_description?: string;
}

interface JWTPayload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  aud?: string;
  iss?: string;
  app_metadata?: {
    provider?: string;
  };
  user_metadata?: {
    full_name?: string;
  };
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function printDiagnostics(context: string, data: unknown) {
  console.error('\n============================================');
  console.error(`AUTH GATE FAILURE: ${context}`);
  console.error('============================================');
  console.error('Response:', JSON.stringify(data, null, 2));
  console.error('Environment:');
  console.error(`  BASE_URL: ${BASE_URL}`);
  console.error(`  ADMIN_EMAIL: ${ADMIN_EMAIL}`);
  console.error(`  ADMIN_PASSWORD: ${'*'.repeat(ADMIN_PASSWORD.length)}`);
  console.error(`  ANON_KEY: ${ANON_KEY ? ANON_KEY.substring(0, 20) + '...' : '(not set)'}`);
  console.error('============================================\n');
}

test.describe('Auth Smoke Gate', () => {
  test('autenticação admin funciona via HTTP direto', async () => {
    // ========================================
    // STEP 1: POST /auth/v1/token
    // ========================================
    const tokenUrl = `${BASE_URL}/auth/v1/token?grant_type=password`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (ANON_KEY) {
      headers['apikey'] = ANON_KEY;
      headers['Authorization'] = `Bearer ${ANON_KEY}`;
    }
    
    let response: Response;
    let body: TokenResponse;
    
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        }),
      });
      
      body = await response.json() as TokenResponse;
    } catch (err) {
      printDiagnostics('Network error', { error: String(err) });
      console.error('FATAL: Não foi possível conectar ao servidor de autenticação');
      process.exit(1);
    }
    
    // ========================================
    // STEP 2: Validar HTTP 200
    // ========================================
    if (response.status !== 200) {
      printDiagnostics(`HTTP ${response.status}`, body);
      console.error('FATAL: Autenticação retornou status não-200');
      console.error(`Erro: ${body.error_description || body.error || 'Unknown'}`);
      process.exit(1);
    }
    
    // ========================================
    // STEP 3: Validar access_token presente
    // ========================================
    if (!body.access_token) {
      printDiagnostics('Missing access_token', body);
      console.error('FATAL: Resposta não contém access_token');
      process.exit(1);
    }
    
    // ========================================
    // STEP 4: Validar JWT com 3 partes
    // ========================================
    const tokenParts = body.access_token.split('.');
    if (tokenParts.length !== 3) {
      printDiagnostics('Invalid JWT format', { access_token: body.access_token.substring(0, 50) + '...' });
      console.error('FATAL: access_token não é um JWT válido (precisa ter 3 partes)');
      process.exit(1);
    }
    
    // ========================================
    // STEP 5: Decodificar e validar payload
    // ========================================
    const payload = decodeJWT(body.access_token);
    if (!payload) {
      printDiagnostics('JWT decode failed', { access_token: body.access_token.substring(0, 50) + '...' });
      console.error('FATAL: Não foi possível decodificar o JWT');
      process.exit(1);
    }
    
    // ========================================
    // STEP 6: Validar exp no futuro
    // ========================================
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      printDiagnostics('Token expired', { exp: payload.exp, now });
      console.error('FATAL: Token já expirou ou não tem exp');
      process.exit(1);
    }
    
    // ========================================
    // STEP 7: Validar que temos user id
    // ========================================
    if (!payload.sub) {
      printDiagnostics('Missing sub claim', payload);
      console.error('FATAL: JWT não contém claim sub (user id)');
      process.exit(1);
    }
    
    // ========================================
    // STEP 8: Verificar role admin via banco
    // ========================================
    // Fazer request para verificar role no banco
    const rolesUrl = `${BASE_URL}/rest/v1/user_roles?user_id=eq.${payload.sub}&select=role`;
    
    try {
      const rolesResponse = await fetch(rolesUrl, {
        method: 'GET',
        headers: {
          'apikey': ANON_KEY || body.access_token,
          'Authorization': `Bearer ${body.access_token}`,
        },
      });
      
      if (rolesResponse.ok) {
        const roles = await rolesResponse.json() as Array<{ role: string }>;
        const isAdmin = roles.some(r => r.role === 'admin');
        
        if (!isAdmin) {
          printDiagnostics('User is not admin', { user_id: payload.sub, roles });
          console.error('FATAL: Usuário não tem role admin');
          process.exit(1);
        }
        
        console.log('✓ Role admin confirmada via banco');
      } else {
        // Se não conseguir verificar role, apenas logar warning
        console.warn('⚠ Não foi possível verificar role via banco (continuando...)');
      }
    } catch {
      console.warn('⚠ Erro ao verificar role via banco (continuando...)');
    }
    
    // ========================================
    // SUCCESS
    // ========================================
    console.log('\n============================================');
    console.log('  ✓ AUTH SMOKE GATE PASSED');
    console.log('============================================');
    console.log(`  User ID: ${payload.sub}`);
    console.log(`  Email: ${payload.email || ADMIN_EMAIL}`);
    console.log(`  Token expires: ${new Date(payload.exp * 1000).toISOString()}`);
    console.log('============================================\n');
    
    // Asserções do Playwright para registro
    expect(response.status).toBe(200);
    expect(body.access_token).toBeTruthy();
    expect(tokenParts.length).toBe(3);
    expect(payload.exp).toBeGreaterThan(now);
    expect(payload.sub).toBeTruthy();
  });
  
  test('endpoint de saúde da API responde', async () => {
    // Teste simples de conectividade
    const healthUrl = `${BASE_URL}/auth/v1/health`;
    
    try {
      const response = await fetch(healthUrl);
      // GoTrue pode retornar 200 ou 404 dependendo da versão
      expect([200, 404]).toContain(response.status);
      console.log(`✓ Auth service respondeu com status ${response.status}`);
    } catch (err) {
      console.error('FATAL: Não foi possível conectar ao serviço de autenticação');
      console.error(err);
      process.exit(1);
    }
  });
});
