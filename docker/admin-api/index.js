/**
 * GUARDA OPERACIONAL - Admin API
 * 
 * Serviço interno para criar usuários via service_role
 * sem trocar a sessão do administrador logado.
 * 
 * Endpoints:
 *   POST /admin/create-user
 *   POST /logs - Recebe logs do frontend
 *   GET /debug/log-test - Testa o sistema de logs
 *   GET /health
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://kong:8000';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  logger.fatal('SUPABASE_SERVICE_ROLE_KEY não definida!');
  process.exit(1);
}

// Cliente Supabase com service_role (acesso total)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
}));
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Não logar health checks para evitar spam
    if (req.path !== '/health') {
      logger.logRequest(req, res.statusCode, duration);
    }
  });
  next();
});

// Middleware de autenticação (verifica se chamador é admin)
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Tentativa de acesso sem token', { path: req.path, ip: req.ip });
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);
    
    // Verificar token e obter usuário
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      logger.warn('Token inválido', { path: req.path, ip: req.ip, error: userError?.message });
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se usuário é admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      logger.logError('Erro ao verificar roles', rolesError, { userId: user.id });
      return res.status(500).json({ error: 'Erro ao verificar permissões' });
    }

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      logger.warn('Acesso negado - usuário não é admin', { userId: user.id, email: user.email });
      return res.status(403).json({ error: 'Acesso negado - requer permissão de admin' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    logger.logError('Erro de autenticação', error);
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};

// ==========================================
// POST /admin/create-user
// ==========================================
app.post('/admin/create-user', requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role = 'security' } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const validRoles = ['admin', 'rh', 'security'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }

    logger.info(`Criando usuário: ${email} (role: ${role})`, { 
      createdBy: req.adminUser.email,
      targetEmail: email,
      targetRole: role 
    });

    // 1. Criar usuário no auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (authError) {
      logger.logError('Erro ao criar usuário no auth', authError, { email });
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Criar perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        full_name: full_name || email,
        must_change_password: true,
        is_active: true,
      });

    if (profileError) {
      logger.logError('Erro ao criar perfil', profileError, { userId, email });
      // Rollback: deletar usuário criado
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Erro ao criar perfil: ' + profileError.message });
    }

    // 3. Atribuir role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) {
      logger.logError('Erro ao atribuir role', roleError, { userId, email, role });
      // Não faz rollback completo, usuário já existe com perfil
      return res.status(500).json({ error: 'Usuário criado mas erro ao atribuir role: ' + roleError.message });
    }

    // 4. Log de auditoria
    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.adminUser.id,
      user_email: req.adminUser.email,
      action_type: 'USER_CREATE',
      details: {
        created_user_email: email,
        created_user_role: role,
      },
    });

    logger.info(`Usuário criado com sucesso: ${email}`, { userId, role });

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        email,
        role,
      },
    });

  } catch (error) {
    logger.logError('Erro interno ao criar usuário', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================================
// POST /logs - Recebe logs do frontend
// ==========================================
app.post('/logs', (req, res) => {
  try {
    const { level = 'error', message, error, source = 'frontend', meta = {} } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const logMeta = {
      service: source,
      ...meta,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
    };

    // Adicionar stack se for erro
    if (error?.stack) {
      logMeta.stack = error.stack;
    }

    // Mapear níveis do frontend para winston
    const levelMap = {
      'fatal': 'fatal',
      'error': 'error',
      'warn': 'warn',
      'warning': 'warn',
      'info': 'info',
      'debug': 'debug',
    };

    const winstonLevel = levelMap[level.toLowerCase()] || 'error';
    logger.log(winstonLevel, `[FRONTEND] ${message}`, logMeta);

    return res.json({ success: true });
  } catch (err) {
    logger.logError('Erro ao processar log do frontend', err);
    return res.status(500).json({ error: 'Failed to log' });
  }
});

// ==========================================
// GET /debug/log-test - Testa o sistema de logs
// ==========================================
app.get('/debug/log-test', (req, res) => {
  const timestamp = new Date().toISOString();
  
  logger.info(`Log test INFO - ${timestamp}`);
  logger.warn(`Log test WARN - ${timestamp}`);
  logger.error(`Log test ERROR - ${timestamp}`);
  
  // Simular erro com stack trace
  try {
    throw new Error('Simulated error for testing');
  } catch (e) {
    logger.logError('Log test ERROR with stack', e, { test: true });
  }

  logger.info('Log test completed', { 
    levels: ['INFO', 'WARN', 'ERROR'],
    timestamp,
    service: 'admin-api'
  });

  return res.json({ 
    success: true, 
    message: 'Logs gerados! Verifique com: tail -f /var/log/visitor-pass/app.log',
    timestamp,
    levels: ['INFO', 'WARN', 'ERROR']
  });
});

// ==========================================
// GET /health - Health check
// ==========================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'guarda-admin-api' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.logError('Unhandled error', err, { path: req.path, method: req.method });
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// BOOTSTRAP: cria o primeiro admin (se não existir)
// Usa ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME do .env
// Não crasha o sistema se falhar.
// ==========================================
const ensureInitialAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  if (!adminEmail || !adminPassword) {
    logger.warn('Bootstrap admin ignorado (ADMIN_EMAIL/ADMIN_PASSWORD não definidos)');
    return;
  }

  try {
    // Já existe algum admin?
    const { data: existingAdmins, error: existingAdminsError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);

    if (existingAdminsError) {
      logger.logError('Bootstrap admin: erro ao checar admins existentes', existingAdminsError);
      return;
    }

    if ((existingAdmins || []).length > 0) {
      logger.info('Bootstrap admin: já existe admin, pulando criação');
      return;
    }

    logger.warn('Bootstrap admin: nenhum admin encontrado, criando admin inicial', { adminEmail });

    // Criar/recuperar usuário no auth
    let userId = null;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    });

    if (createError) {
      // Se já existir, buscar pelo listUsers
      const msg = (createError.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (listError) {
          logger.logError('Bootstrap admin: erro ao listar usuários', listError, { adminEmail });
          return;
        }

        const found = (listed?.users || []).find((u) => (u.email || '').toLowerCase() === adminEmail.toLowerCase());
        if (!found) {
          logger.error('Bootstrap admin: usuário já existe mas não foi encontrado no listUsers', { adminEmail });
          return;
        }
        userId = found.id;
      } else {
        logger.logError('Bootstrap admin: erro ao criar usuário no auth', createError, { adminEmail });
        return;
      }
    } else {
      userId = created?.user?.id;
    }

    if (!userId) {
      logger.error('Bootstrap admin: não foi possível determinar userId', { adminEmail });
      return;
    }

    // Upsert perfil
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: adminName,
          must_change_password: true,
          is_active: true,
        },
        { onConflict: 'user_id' }
      );

    if (profileUpsertError) {
      logger.logError('Bootstrap admin: erro ao upsert do perfil', profileUpsertError, { userId, adminEmail });
      return;
    }

    // Upsert role admin
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        {
          user_id: userId,
          role: 'admin',
        },
        { onConflict: 'user_id,role' }
      );

    if (roleUpsertError) {
      logger.logError('Bootstrap admin: erro ao upsert da role admin', roleUpsertError, { userId, adminEmail });
      return;
    }

    logger.info('Bootstrap admin: admin inicial pronto', { userId, adminEmail });
  } catch (error) {
    logger.logError('Bootstrap admin: erro inesperado', error, { adminEmail: process.env.ADMIN_EMAIL });
  }
};

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor iniciado na porta ${PORT}`, {
    supabaseUrl: SUPABASE_URL,
    logDir: process.env.LOG_DIR || '/var/log/visitor-pass',
  });

  // Rodar bootstrap em background
  ensureInitialAdmin().catch((e) => logger.logError('Bootstrap admin: falha', e));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, encerrando...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { stack: error.stack, message: error.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
