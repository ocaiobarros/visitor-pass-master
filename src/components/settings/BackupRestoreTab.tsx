import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Upload, 
  AlertTriangle, 
  Database, 
  FileDown, 
  CheckCircle2,
  Terminal,
  Copy
} from 'lucide-react';

const TABLES_TO_EXPORT = [
  'departments',
  'profiles',
  'user_roles',
  'visitors',
  'employee_credentials',
  'access_logs'
];

const BackupRestoreTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const generateSQLInserts = (tableName: string, data: any[]): string => {
    if (!data || data.length === 0) return `-- Tabela ${tableName}: sem dados\n`;

    const columns = Object.keys(data[0]);
    const inserts = data.map(row => {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'number') return val;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      return `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
    });

    return `-- Tabela: ${tableName} (${data.length} registros)\n${inserts.join('\n')}\n\n`;
  };

  const fetchTableData = async (tableName: string) => {
    switch (tableName) {
      case 'departments':
        return supabase.from('departments').select('*');
      case 'profiles':
        return supabase.from('profiles').select('*');
      case 'user_roles':
        return supabase.from('user_roles').select('*');
      case 'visitors':
        return supabase.from('visitors').select('*');
      case 'employee_credentials':
        return supabase.from('employee_credentials').select('*');
      case 'access_logs':
        return supabase.from('access_logs').select('*');
      default:
        throw new Error(`Tabela desconhecida: ${tableName}`);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      let sqlContent = `-- =============================================
-- BACKUP GUARDA OPERACIONAL
-- Data: ${new Date().toISOString()}
-- Formato: PostgreSQL 15/16 compatível
-- =============================================

-- IMPORTANTE: Execute este script em um banco de dados limpo
-- ou faça TRUNCATE nas tabelas antes de importar.

-- Desabilitar verificações de FK temporariamente
SET session_replication_role = replica;

`;

      const progressStep = 100 / TABLES_TO_EXPORT.length;

      for (let i = 0; i < TABLES_TO_EXPORT.length; i++) {
        const table = TABLES_TO_EXPORT[i];
        
        const { data, error } = await fetchTableData(table);

        if (error) {
          console.error(`Erro ao exportar ${table}:`, error);
          sqlContent += `-- ERRO ao exportar ${table}: ${error.message}\n\n`;
        } else {
          sqlContent += generateSQLInserts(table, (data as Record<string, unknown>[]) || []);
        }

        setExportProgress((i + 1) * progressStep);
      }

      sqlContent += `
-- Reabilitar verificações de FK
SET session_replication_role = DEFAULT;

-- =============================================
-- FIM DO BACKUP
-- =============================================
`;

      // Create and download file
      const blob = new Blob([sqlContent], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guarda_operacional_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup concluído!',
        description: 'O arquivo SQL foi baixado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro no backup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isValid = file.name.endsWith('.sql') || file.name.endsWith('.tar');
      if (!isValid) {
        toast({
          title: 'Arquivo inválido',
          description: 'Selecione um arquivo .sql ou .tar',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const copyToClipboard = async (text: string, commandId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCommand(commandId);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const restoreCommands = {
    truncate: `psql -U postgres -d guarda_operacional -c "
TRUNCATE TABLE public.access_logs CASCADE;
TRUNCATE TABLE public.employee_credentials CASCADE;
TRUNCATE TABLE public.visitors CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.departments CASCADE;
"`,
    restore: `psql -U postgres -d guarda_operacional < /caminho/para/backup.sql`,
    fullRestore: `# 1. Conectar ao PostgreSQL
sudo -u postgres psql

# 2. Limpar dados existentes (dentro do psql)
\\c guarda_operacional
TRUNCATE TABLE public.access_logs CASCADE;
TRUNCATE TABLE public.employee_credentials CASCADE;
TRUNCATE TABLE public.visitors CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.departments CASCADE;
\\q

# 3. Restaurar backup
sudo -u postgres psql guarda_operacional < backup.sql`
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Exportar Backup
          </CardTitle>
          <CardDescription>
            Gere um arquivo SQL contendo todos os dados do sistema para backup ou migração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h4 className="font-medium text-sm">Tabelas incluídas no backup:</h4>
              <div className="flex flex-wrap gap-2">
                {TABLES_TO_EXPORT.map(table => (
                  <span key={table} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-mono">
                    {table}
                  </span>
                ))}
              </div>
            </div>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exportando dados...</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}

            <Button 
              onClick={handleExportBackup}
              disabled={isExporting}
              size="lg"
              className="w-full gap-2"
            >
              {isExporting ? (
                <>
                  <Download className="w-5 h-5 animate-pulse" />
                  Gerando backup...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  Gerar e Baixar Backup Completo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Restaurar Backup
          </CardTitle>
          <CardDescription>
            Carregue um arquivo de backup para restaurar no servidor local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">ATENÇÃO: OPERAÇÃO DESTRUTIVA</AlertTitle>
            <AlertDescription>
              A restauração apagará <strong>TODOS os dados atuais</strong> e os substituirá 
              pelos dados do arquivo de backup. Certifique-se de que é o arquivo correto 
              antes de prosseguir.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="backup-file">Selecionar arquivo de backup</Label>
            <Input
              id="backup-file"
              type="file"
              accept=".sql,.tar"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 rounded bg-muted text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Arquivo selecionado: <strong>{selectedFile.name}</strong></span>
                <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          <Alert className="bg-warning/10 border-warning/30">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Restauração via Terminal (Recomendado)</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p className="text-sm">
                Por segurança, a restauração deve ser feita diretamente no servidor Debian 12 
                via linha de comando. Siga os passos abaixo:
              </p>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">1. Limpar dados existentes:</p>
                <div className="relative">
                  <pre className="p-3 rounded bg-background text-xs overflow-x-auto font-mono">
                    {restoreCommands.truncate}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => copyToClipboard(restoreCommands.truncate, 'truncate')}
                  >
                    {copiedCommand === 'truncate' ? (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">2. Importar backup:</p>
                <div className="relative">
                  <pre className="p-3 rounded bg-background text-xs overflow-x-auto font-mono">
                    {restoreCommands.restore}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => copyToClipboard(restoreCommands.restore, 'restore')}
                  >
                    {copiedCommand === 'restore' ? (
                      <CheckCircle2 className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <Button 
            variant="outline"
            disabled={!selectedFile}
            className="w-full gap-2"
            onClick={() => {
              toast({
                title: 'Restauração via Terminal',
                description: 'Transfira o arquivo para o servidor e use os comandos acima para restaurar.',
              });
            }}
          >
            <Upload className="w-4 h-4" />
            Instruções de Restauração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupRestoreTab;
