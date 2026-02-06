import DashboardLayout from '@/components/DashboardLayout';
import AuditLogsTab from '@/components/settings/AuditLogsTab';
import { FileText } from 'lucide-react';

/**
 * Página standalone de Logs de Auditoria
 * Acessível via /audit
 */
const AuditLogs = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground mt-1">
            Histórico completo de ações administrativas no sistema
          </p>
        </div>

        <AuditLogsTab />
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;
