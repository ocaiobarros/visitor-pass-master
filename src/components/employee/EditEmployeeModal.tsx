import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUpdateCredential } from '@/hooks/useEmployeeCredentials';
import { useDepartments } from '@/hooks/useDepartments';
import { logAuditAction } from '@/hooks/useAuditLogs';
import { EmployeeCredential } from '@/types/visitor';
import { Loader2, Upload } from 'lucide-react';

interface Props {
  employee: EmployeeCredential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditEmployeeModal = ({ employee, open, onOpenChange }: Props) => {
  const updateCredential = useUpdateCredential();
  const { data: departments = [] } = useDepartments();

  const [departmentId, setDepartmentId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (employee) {
      setDepartmentId(employee.departmentId || '');
      setJobTitle(employee.jobTitle || '');
      setPhotoUrl(employee.photoUrl || '');
    }
  }, [employee]);

  if (!employee) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const changes: Record<string, { from: string | null; to: string | null }> = {};

    if ((departmentId || null) !== (employee.departmentId || null)) {
      changes.department_id = { from: employee.departmentId || null, to: departmentId || null };
    }
    if ((jobTitle || null) !== (employee.jobTitle || null)) {
      changes.job_title = { from: employee.jobTitle || null, to: jobTitle || null };
    }
    if ((photoUrl || null) !== (employee.photoUrl || null)) {
      changes.photo_url = { from: 'previous', to: 'updated' };
    }

    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }

    updateCredential.mutate({
      id: employee.id,
      departmentId: departmentId || null,
      jobTitle: jobTitle || null,
      photoUrl: photoUrl || null,
    }, {
      onSuccess: () => {
        logAuditAction('EMPLOYEE_UPDATE', {
          employee_id: employee.id,
          employee_name: employee.fullName,
          changes,
        });
        onOpenChange(false);
      },
    });
  };

  const initials = employee.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Info (read-only) */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{employee.fullName}</span> — {employee.document}
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <Label>Foto</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoUrl || undefined} alt={employee.fullName} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{initials}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Upload className="w-4 h-4" />
                  Alterar foto
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Analista, Gerente..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateCredential.isPending} className="flex-1 gap-2">
              {updateCredential.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeModal;
