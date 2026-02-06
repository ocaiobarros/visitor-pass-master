/**
 * GUARDA OPERACIONAL - Admin API
 * 
 * Serviço interno para criar usuários via service_role
 * sem trocar a sessão do administrador logado.
 * 
 * Endpoints:
 *   POST /admin/create-user
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://kong:8000';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY não definida!');
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
app.use(express.json());

// Middleware de autenticação (verifica se chamador é admin)
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);
    
    // Verificar token e obter usuário
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se usuário é admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Erro ao verificar roles:', rolesError);
      return res.status(500).json({ error: 'Erro ao verificar permissões' });
    }

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Acesso negado - requer permissão de admin' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};

// POST /admin/create-user
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

    console.log(`[admin-api] Criando usuário: ${email} (role: ${role})`);

    // 1. Criar usuário no auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (authError) {
      console.error('[admin-api] Erro ao criar usuário:', authError);
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
      console.error('[admin-api] Erro ao criar perfil:', profileError);
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
      console.error('[admin-api] Erro ao atribuir role:', roleError);
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

    console.log(`[admin-api] ✓ Usuário criado com sucesso: ${email}`);

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        email,
        role,
      },
    });

  } catch (error) {
    console.error('[admin-api] Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'guarda-admin-api' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[admin-api] Servidor rodando na porta ${PORT}`);
  console.log(`[admin-api] SUPABASE_URL: ${SUPABASE_URL}`);
});
