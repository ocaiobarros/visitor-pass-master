import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GenericReport, { ReportConfig, directionBadge, statusBadge, personTypeBadge, opStatusBadge } from '@/components/reports/GenericReport';
import ExecutiveReport from '@/components/reports/ExecutiveReport';
import { FileBarChart, Users, ShieldAlert, Clock, Car, BarChart3, UserCheck, UserPlus } from 'lucide-react';

const PERSON_TYPE_OPTIONS = [
  { value: 'visitor', label: 'Visitante' },
  { value: 'employee', label: 'Colaborador' },
  { value: 'associate', label: 'Agregado' },
];

const SESSION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluída' },
  { value: 'denied', label: 'Negada' },
  { value: 'expired', label: 'Expirada' },
];

const VISITOR_OP_STATUS_OPTIONS = [
  { value: 'Finalizado', label: 'Finalizado' },
  { value: 'Dentro', label: 'Dentro' },
  { value: 'Expirado sem uso', label: 'Expirado sem uso' },
  { value: 'Negado', label: 'Negado' },
  { value: 'Pendente', label: 'Pendente' },
];

const CREDENTIAL_STATUS_OPTIONS = [
  { value: 'allowed', label: 'Ativo' },
  { value: 'blocked', label: 'Bloqueado' },
];

const ASSOCIATE_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'expired', label: 'Expirado' },
];

/* ── Operational Reports ── */

const presenceConfig: ReportConfig = {
  title: 'Presença Atual — Quem está dentro agora',
  rpcName: 'report_presence_now',
  columns: [
    { key: 'person_name', label: 'Nome' },
    { key: 'document', label: 'Documento' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'entry_time', label: 'Entrada', format: 'datetime' },
    { key: 'duration_minutes', label: 'Permanência', format: 'duration' },
    { key: 'gate_id', label: 'Portão' },
    { key: 'vehicle_plate', label: 'Veículo' },
    { key: 'responsible_name', label: 'Responsável' },
    { key: 'department_name', label: 'Setor' },
  ],
  filters: [],
};

const permanenceConfig: ReportConfig = {
  title: 'Sessões de Permanência',
  rpcName: 'report_permanence',
  columns: [
    { key: 'person_name', label: 'Nome' },
    { key: 'document', label: 'Documento' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'entry_time', label: 'Entrada', format: 'datetime' },
    { key: 'exit_time', label: 'Saída', format: 'datetime' },
    { key: 'duration_minutes', label: 'Duração', format: 'duration' },
    { key: 'gate_id', label: 'Portão' },
    { key: 'vehicle_plate', label: 'Veículo' },
  ],
  filters: [
    { key: 'document', label: 'CPF/Documento', type: 'text', placeholder: 'Buscar...', rpcParam: 'p_document' },
    { key: 'person_type', label: 'Tipo', type: 'select', options: PERSON_TYPE_OPTIONS, rpcParam: 'p_person_type' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const sessionsConfig: ReportConfig = {
  title: 'Sessões de Acesso',
  rpcName: 'report_sessions',
  columns: [
    { key: 'created_at', label: 'Abertura', format: 'datetime' },
    { key: 'session_type', label: 'Tipo Sessão' },
    { key: 'status', label: 'Status', format: 'session_status' },
    { key: 'person_name', label: 'Pessoa' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'visitor_name', label: 'Visitante' },
    { key: 'vehicle_plate', label: 'Placa' },
    { key: 'authorization_type', label: 'Autorização' },
    { key: 'denial_reason', label: 'Motivo Negativa' },
    { key: 'completed_at', label: 'Conclusão', format: 'datetime' },
  ],
  filters: [
    { key: 'status', label: 'Status', type: 'select', options: SESSION_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const denialsConfig: ReportConfig = {
  title: 'Negativas / Bloqueios',
  rpcName: 'report_denials',
  columns: [
    { key: 'created_at', label: 'Data/Hora', format: 'datetime' },
    { key: 'person_name', label: 'Pessoa' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'document', label: 'Documento' },
    { key: 'vehicle_plate', label: 'Veículo' },
    { key: 'denial_reason', label: 'Motivo' },
    { key: 'session_type', label: 'Tipo Sessão' },
    { key: 'operator_name', label: 'Operador' },
  ],
  filters: [
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

/* ── Detailed / Tactical Reports ── */

const timelineConfig: ReportConfig = {
  title: 'Timeline de Acesso',
  rpcName: 'report_person_timeline',
  columns: [
    { key: 'created_at', label: 'Data/Hora', format: 'datetime' },
    { key: 'person_name', label: 'Nome' },
    { key: 'document', label: 'Documento' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'direction', label: 'Direção', format: 'badge', badgeVariant: directionBadge },
    { key: 'gate_id', label: 'Portão' },
    { key: 'vehicle_plate', label: 'Veículo' },
    { key: 'entity_status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'responsible_name', label: 'Responsável' },
    { key: 'department_name', label: 'Setor' },
  ],
  filters: [
    { key: 'document', label: 'CPF/Documento', type: 'text', placeholder: 'Buscar por documento...', rpcParam: 'p_document' },
    { key: 'name', label: 'Nome', type: 'text', placeholder: 'Buscar por nome...', rpcParam: 'p_name' },
    { key: 'person_type', label: 'Tipo de Pessoa', type: 'select', options: PERSON_TYPE_OPTIONS, rpcParam: 'p_person_type' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const vehicleConfig: ReportConfig = {
  title: 'Relatório Veicular — Sessões Consolidadas',
  rpcName: 'report_vehicle_sessions',
  columns: [
    { key: 'vehicle_plate', label: 'Placa' },
    { key: 'vehicle_model', label: 'Veículo' },
    { key: 'person_name', label: 'Condutor' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'gate_id', label: 'Portão' },
    { key: 'entry_time', label: 'Entrada', format: 'datetime' },
    { key: 'exit_time', label: 'Saída', format: 'datetime' },
    { key: 'duration_minutes', label: 'Permanência', format: 'duration' },
    { key: 'session_status', label: 'Status', format: 'badge', badgeVariant: opStatusBadge },
  ],
  filters: [
    { key: 'plate', label: 'Placa', type: 'text', placeholder: 'Buscar por placa...', rpcParam: 'p_plate' },
    { key: 'owner', label: 'Condutor', type: 'text', placeholder: 'Buscar por nome...', rpcParam: 'p_owner' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const visitorsConfig: ReportConfig = {
  title: 'Visitantes — Sessões Operacionais',
  rpcName: 'report_visitors_operational',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'Documento' },
    { key: 'company_name', label: 'Empresa' },
    { key: 'company_reason', label: 'Motivo' },
    { key: 'visit_to_name', label: 'Destino' },
    { key: 'access_type', label: 'Acesso' },
    { key: 'gate_id', label: 'Portão' },
    { key: 'entry_time', label: 'Entrada', format: 'datetime' },
    { key: 'exit_time', label: 'Saída', format: 'datetime' },
    { key: 'duration_minutes', label: 'Permanência', format: 'duration' },
    { key: 'operational_status', label: 'Status', format: 'badge', badgeVariant: opStatusBadge },
  ],
  filters: [
    { key: 'status', label: 'Status', type: 'select', options: VISITOR_OP_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const employeesConfig: ReportConfig = {
  title: 'Colaboradores — Cadastro e Operação',
  rpcName: 'report_employees_detailed',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'CPF' },
    { key: 'credential_id', label: 'Credencial' },
    { key: 'department_name', label: 'Setor' },
    { key: 'job_title', label: 'Cargo' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'current_state', label: 'Estado Atual', format: 'badge', badgeVariant: opStatusBadge },
    { key: 'last_entry', label: 'Última Entrada', format: 'datetime' },
    { key: 'last_exit', label: 'Última Saída', format: 'datetime' },
    { key: 'duration_minutes', label: 'Permanência', format: 'duration' },
    { key: 'access_count', label: 'Acessos', format: 'number' },
    { key: 'vehicle_count', label: 'Veículos', format: 'number' },
    { key: 'associate_count', label: 'Agregados', format: 'number' },
  ],
  filters: [
    { key: 'department', label: 'Setor', type: 'text', placeholder: 'Buscar setor...', rpcParam: 'p_department' },
    { key: 'status', label: 'Status', type: 'select', options: CREDENTIAL_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Período Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Período Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const associatesConfig: ReportConfig = {
  title: 'Agregados — Cadastro e Operação',
  rpcName: 'report_associates_detailed',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'CPF' },
    { key: 'pass_id', label: 'Passe' },
    { key: 'relationship_type', label: 'Vínculo' },
    { key: 'responsible_name', label: 'Responsável' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'current_state', label: 'Estado Atual', format: 'badge', badgeVariant: opStatusBadge },
    { key: 'last_entry', label: 'Última Entrada', format: 'datetime' },
    { key: 'last_exit', label: 'Última Saída', format: 'datetime' },
    { key: 'duration_minutes', label: 'Permanência', format: 'duration' },
    { key: 'access_count', label: 'Acessos', format: 'number' },
    { key: 'vehicle_auth_count', label: 'Veículos', format: 'number' },
  ],
  filters: [
    { key: 'status', label: 'Status', type: 'select', options: ASSOCIATE_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Período Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Período Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

/* ── Tab groups ── */
const OPERATIONAL_TABS = [
  { id: 'presence', label: 'Presença Atual', icon: Users, config: presenceConfig },
  { id: 'permanence', label: 'Permanência', icon: Clock, config: permanenceConfig },
  { id: 'sessions', label: 'Sessões', icon: BarChart3, config: sessionsConfig },
  { id: 'denials', label: 'Negativas', icon: ShieldAlert, config: denialsConfig },
] as const;

const DETAILED_TABS = [
  { id: 'timeline', label: 'Timeline', config: timelineConfig },
  { id: 'vehicle', label: 'Veicular', icon: Car, config: vehicleConfig },
  { id: 'visitors', label: 'Visitantes', icon: UserPlus, config: visitorsConfig },
  { id: 'employees', label: 'Colaboradores', icon: UserCheck, config: employeesConfig },
  { id: 'associates', label: 'Agregados', config: associatesConfig },
  { id: 'executive', label: 'Executivo', config: null },
] as const;

const ALL_TABS = [...OPERATIONAL_TABS, ...DETAILED_TABS];

const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileBarChart className="w-8 h-8 text-primary" />
            Relatórios Operacionais
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatórios baseados em sessões consolidadas — entrada, saída, permanência e negativas
          </p>
        </div>

        <Tabs defaultValue="presence" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {OPERATIONAL_TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1">
                {t.icon && <t.icon className="w-3 h-3" />}
                {t.label}
              </TabsTrigger>
            ))}
            <span className="w-px h-6 bg-border mx-1 self-center" />
            {DETAILED_TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1">
                {'icon' in t && t.icon && <t.icon className="w-3 h-3" />}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ALL_TABS.map(t => (
            <TabsContent key={t.id} value={t.id}>
              {t.id === 'executive' ? (
                <ExecutiveReport />
              ) : (
                <GenericReport config={t.config!} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
