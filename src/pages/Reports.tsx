import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GenericReport, { ReportConfig, directionBadge, statusBadge, personTypeBadge } from '@/components/reports/GenericReport';
import ExecutiveReport from '@/components/reports/ExecutiveReport';
import { FileBarChart } from 'lucide-react';

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

const VISITOR_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'inside', label: 'Dentro' },
  { value: 'outside', label: 'Fora' },
  { value: 'closed', label: 'Encerrado' },
  { value: 'expired_unused', label: 'Expirado' },
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

const timelineConfig: ReportConfig = {
  title: 'Timeline por Pessoa',
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
  title: 'Relatório Veicular',
  rpcName: 'report_vehicle_activity',
  columns: [
    { key: 'created_at', label: 'Data/Hora', format: 'datetime' },
    { key: 'vehicle_plate', label: 'Placa' },
    { key: 'vehicle_model', label: 'Veículo' },
    { key: 'person_name', label: 'Condutor' },
    { key: 'person_type', label: 'Tipo', format: 'badge', badgeVariant: personTypeBadge },
    { key: 'direction', label: 'Direção', format: 'badge', badgeVariant: directionBadge },
    { key: 'gate_id', label: 'Portão' },
    { key: 'entity_status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'responsible_name', label: 'Responsável' },
  ],
  filters: [
    { key: 'plate', label: 'Placa', type: 'text', placeholder: 'Buscar por placa...', rpcParam: 'p_plate' },
    { key: 'owner', label: 'Proprietário/Condutor', type: 'text', placeholder: 'Buscar por nome...', rpcParam: 'p_owner' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const sessionsConfig: ReportConfig = {
  title: 'Sessões Veiculares',
  rpcName: 'report_sessions',
  columns: [
    { key: 'created_at', label: 'Data/Hora', format: 'datetime' },
    { key: 'session_type', label: 'Tipo Sessão' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'person_name', label: 'Condutor' },
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

const presenceConfig: ReportConfig = {
  title: 'Presença Atual',
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
  title: 'Permanência',
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

const visitorsConfig: ReportConfig = {
  title: 'Visitantes',
  rpcName: 'report_visitors_detailed',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'Documento' },
    { key: 'company_name', label: 'Empresa' },
    { key: 'company_reason', label: 'Motivo' },
    { key: 'visit_to_name', label: 'Destino' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'access_type', label: 'Acesso' },
    { key: 'vehicle_plate', label: 'Veículo' },
    { key: 'valid_from', label: 'Válido De', format: 'datetime' },
    { key: 'valid_until', label: 'Válido Até', format: 'datetime' },
    { key: 'entry_count', label: 'Entradas', format: 'number' },
    { key: 'exit_count', label: 'Saídas', format: 'number' },
    { key: 'last_access', label: 'Último Acesso', format: 'datetime' },
  ],
  filters: [
    { key: 'status', label: 'Status', type: 'select', options: VISITOR_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Data Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Data Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const employeesConfig: ReportConfig = {
  title: 'Colaboradores',
  rpcName: 'report_employees_detailed',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'CPF' },
    { key: 'credential_id', label: 'Credencial' },
    { key: 'department_name', label: 'Setor' },
    { key: 'job_title', label: 'Cargo' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'created_at', label: 'Cadastro', format: 'date' },
    { key: 'access_count', label: 'Acessos', format: 'number' },
    { key: 'last_access', label: 'Último Acesso', format: 'datetime' },
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
  title: 'Agregados',
  rpcName: 'report_associates_detailed',
  columns: [
    { key: 'full_name', label: 'Nome' },
    { key: 'document', label: 'CPF' },
    { key: 'pass_id', label: 'Passe' },
    { key: 'relationship_type', label: 'Vínculo' },
    { key: 'responsible_name', label: 'Responsável' },
    { key: 'status', label: 'Status', format: 'badge', badgeVariant: statusBadge },
    { key: 'validity_type', label: 'Validade' },
    { key: 'valid_from', label: 'Válido De', format: 'date' },
    { key: 'valid_until', label: 'Válido Até', format: 'date' },
    { key: 'access_count', label: 'Acessos', format: 'number' },
    { key: 'last_access', label: 'Último Acesso', format: 'datetime' },
    { key: 'vehicle_auth_count', label: 'Veículos', format: 'number' },
  ],
  filters: [
    { key: 'status', label: 'Status', type: 'select', options: ASSOCIATE_STATUS_OPTIONS, rpcParam: 'p_status' },
    { key: 'start', label: 'Período Início', type: 'date', rpcParam: 'p_start' },
    { key: 'end', label: 'Período Fim', type: 'date', rpcParam: 'p_end' },
  ],
};

const TABS = [
  { id: 'timeline', label: 'Timeline', config: timelineConfig },
  { id: 'vehicle', label: 'Veicular', config: vehicleConfig },
  { id: 'sessions', label: 'Sessões', config: sessionsConfig },
  { id: 'denials', label: 'Negativas', config: denialsConfig },
  { id: 'presence', label: 'Presença', config: presenceConfig },
  { id: 'permanence', label: 'Permanência', config: permanenceConfig },
  { id: 'visitors', label: 'Visitantes', config: visitorsConfig },
  { id: 'employees', label: 'Colaboradores', config: employeesConfig },
  { id: 'associates', label: 'Agregados', config: associatesConfig },
  { id: 'executive', label: 'Executivo', config: null },
] as const;

const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileBarChart className="w-8 h-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatórios operacionais e táticos com dados reais do sistema
          </p>
        </div>

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(t => (
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
