import DashboardLayout from '@/components/DashboardLayout';
import ReportsTab from '@/components/settings/ReportsTab';
import { FileBarChart } from 'lucide-react';

/**
 * Página standalone de Relatórios
 * Acessível via /reports
 */
const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileBarChart className="w-8 h-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere relatórios detalhados com filtros avançados para análise e conformidade
          </p>
        </div>

        <ReportsTab />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
