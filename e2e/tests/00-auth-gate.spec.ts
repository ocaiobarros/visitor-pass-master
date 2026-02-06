/**
 * ============================================
 * AUTH SMOKE GATE (PROTOCOLO 2026)
 * ============================================
 * PROVA A (Auth API, sem UI, sem SDK):
 *   POST /auth/v1/token?grant_type=password
 *   - apikey SEMPRE por header
 *   - loga status + body sanitizado (tokens mascarados)
 *
 * PROVA B (RBAC real do app):
 *   - request autenticada com Authorization: Bearer <access_token>
 *   - lê fonte real: public.user_roles
 *   - valida role=admin
 *
 * Fail-fast: process.exit(1) imediatamente em qualquer falha.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:8000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ANON_KEY = process.env.ANON_KEY || '';

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type JWTPayload = {
  sub?: string;
  email?: string;
  exp?: number;
  role?: string;
  aud?: string | string[];
  iss?: string;
};

function maskToken(token?: string, keep = 12) {
  if (!token) return undefined;
  if (token.length <= keep * 2) return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  return `${token.substring(0, keep)}...${token.substring(token.length - keep)}`;
}

function sanitizeTokenResponse(body: TokenResponse) {
  return {
    ...body,
    access_token: maskToken(body.access_token),
    refresh_token: maskToken(body.refresh_token),
  };
}

function decodeJWT(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido (não tem 3 partes)');
  const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(payloadJson) as JWTPayload;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // limitar output
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  }
}

function failFast(context: string, details: Record<string, unknown>) {
  console.error('\n============================================');
  console.error(`AUTH GATE FAIL-FAST: ${context}`);
  console.error('============================================');
  console.error(JSON.stringify(details, null, 2));
  console.error('============================================\n');
  process.exit(1);
}

test.describe('00 - Auth Gate (Fail-Fast)', () => {
  test('PROVA A + PROVA B (token + RBAC user_roles)', async () => {
    // ========================================
    // Fail-fast env validation
    // ========================================
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      failFast('Missing ADMIN_EMAIL/ADMIN_PASSWORD', {
        ADMIN_EMAIL: ADMIN_EMAIL || '(missing)',
        ADMIN_PASSWORD: ADMIN_PASSWORD ? 'SET' : '(missing)',
        BASE_URL,
      });
    }
    if (!ANON_KEY) {
      failFast('Missing ANON_KEY', { BASE_URL });
    }

    // ========================================
    // PROVA A — Auth API (NO UI, NO SDK)
    // ========================================
    const tokenUrl = `${BASE_URL}/auth/v1/token?grant_type=password`;

    let tokenRes: Response;
    let tokenBodyUnknown: unknown;

    try {
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      tokenBodyUnknown = await readJsonSafe(tokenRes);
    } catch (err) {
      failFast('Network error calling /auth/v1/token', {
        tokenUrl,
        error: String(err),
      });
    }

    const tokenBody = (tokenBodyUnknown ?? {}) as TokenResponse;

    // Log obrigatório (status + body sanitizado)
    console.log('[PROVA A] /auth/v1/token status:', tokenRes.status);
    console.log('[PROVA A] /auth/v1/token body:', JSON.stringify(sanitizeTokenResponse(tokenBody), null, 2));

    if (tokenRes.status !== 200) {
      failFast(`PROVA A failed (HTTP ${tokenRes.status})`, {
        tokenUrl,
        status: tokenRes.status,
        body: sanitizeTokenResponse(tokenBody),
      });
    }

    if (!tokenBody.access_token) {
      failFast('PROVA A failed (missing access_token)', {
        status: tokenRes.status,
        body: sanitizeTokenResponse(tokenBody),
      });
    }

    const parts = tokenBody.access_token.split('.');
    if (parts.length !== 3) {
      failFast('PROVA A failed (access_token not JWT 3 parts)', {
        access_token: maskToken(tokenBody.access_token),
      });
    }

    let payload: JWTPayload;
    try {
      payload = decodeJWT(tokenBody.access_token);
    } catch (err) {
      failFast('PROVA A failed (JWT decode)', {
        access_token: maskToken(tokenBody.access_token),
        error: String(err),
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      failFast('PROVA A failed (token exp invalid)', { exp: payload.exp, now });
    }

    if (!payload.sub) {
      failFast('PROVA A failed (missing sub)', payload as unknown as Record<string, unknown>);
    }

    // ========================================
    // PROVA B — RBAC real (user_roles)
    // ========================================
    const rolesUrl = `${BASE_URL}/rest/v1/user_roles?user_id=eq.${payload.sub}&select=role`;

    let rolesRes: Response;
    let rolesBodyUnknown: unknown;

    try {
      rolesRes = await fetch(rolesUrl, {
        method: 'GET',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${tokenBody.access_token}`,
        },
      });
      rolesBodyUnknown = await readJsonSafe(rolesRes);
    } catch (err) {
      failFast('PROVA B network error reading RBAC', {
        rolesUrl,
        error: String(err),
      });
    }

    console.log('[PROVA B] RBAC source: public.user_roles');
    console.log('[PROVA B] GET user_roles status:', rolesRes.status);
    console.log('[PROVA B] GET user_roles body:', JSON.stringify(rolesBodyUnknown, null, 2));

    if (!rolesRes.ok) {
      failFast(`PROVA B failed (HTTP ${rolesRes.status})`, {
        rolesUrl,
        status: rolesRes.status,
        body: rolesBodyUnknown,
        hint: 'Erro típico aqui é 401/403/42501 (RLS/headers).',
      });
    }

    const roles = Array.isArray(rolesBodyUnknown) ? (rolesBodyUnknown as Array<{ role?: string }>) : [];
    const isAdmin = roles.some((r) => r.role === 'admin');

    if (!isAdmin) {
      failFast('PROVA B failed (admin role missing)', {
        user_id: payload.sub,
        roles,
      });
    }

    console.log('✓ Auth Gate PASSED (token OK + role admin OK)');

    // Asserções (para registrar no report)
    expect(tokenRes.status).toBe(200);
    expect(parts.length).toBe(3);
    expect(payload.exp).toBeGreaterThan(now);
    expect(isAdmin).toBeTruthy();
  });
});
