
## Renomeação do perfil `rh` → `operador_acesso`

### Impacto técnico
O valor `rh` é um **valor de ENUM persistido** (`app_role`), não apenas um label. A mudança afeta:

### 1. Migration SQL (banco)
- Adicionar `operador_acesso` ao enum `app_role`
- Atualizar `user_roles` existentes: `UPDATE user_roles SET role='operador_acesso' WHERE role='rh'`
- Atualizar função `is_admin_or_rh()` → renomear para `is_admin_or_operador()` (ou manter nome e alterar corpo)
- Remover `rh` do enum (ALTER TYPE ... RENAME VALUE)
- Atualizar RLS policies que usam `is_admin_or_rh()`

### 2. Frontend (5 arquivos)
- `src/types/visitor.ts`: `AppRole` type + helpers
- `src/App.tsx`: `requiredRoles` nas rotas
- `src/context/AuthContext.tsx`: `isAdminOrRh` computed property
- `src/components/settings/UsersManagementTab.tsx`: labels nos selects
- `src/components/DashboardLayout.tsx`: display do role no sidebar (atualmente mostra `.capitalize()`)

### 3. Arquivos read-only (auto-atualizados após migration)
- `src/integrations/supabase/types.ts`: será atualizado automaticamente

### Abordagem segura
1. Migration: ADD novo valor → UPDATE dados → renomear função → DROP valor antigo
2. Frontend: substituir todas referências de `'rh'` por `'operador_acesso'`
3. Label no sidebar: mapear `operador_acesso` → "Operador de Acesso"

### Riscos
- Usuários existentes com `role='rh'` perdem acesso se a migration não rodar antes do deploy do frontend
- A migration deve ser atômica
