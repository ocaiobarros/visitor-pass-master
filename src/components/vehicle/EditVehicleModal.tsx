import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateCredential } from '@/hooks/useEmployeeCredentials';
import { logAuditAction } from '@/hooks/useAuditLogs';
import { EmployeeCredential } from '@/types/visitor';
import { Loader2, Car } from 'lucide-react';

interface Props {
  vehicle: EmployeeCredential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditVehicleModal = ({ vehicle, open, onOpenChange }: Props) => {
  const updateCredential = useUpdateCredential();

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');

  useEffect(() => {
    if (vehicle) {
      setVehiclePlate(vehicle.vehiclePlate || '');
      setVehicleMakeModel(vehicle.vehicleMakeModel || '');
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const handleSave = async () => {
    const changes: Record<string, { from: string | null; to: string | null }> = {};

    if ((vehiclePlate || null) !== (vehicle.vehiclePlate || null)) {
      changes.vehicle_plate = { from: vehicle.vehiclePlate || null, to: vehiclePlate || null };
    }
    if ((vehicleMakeModel || null) !== (vehicle.vehicleMakeModel || null)) {
      changes.vehicle_make_model = { from: vehicle.vehicleMakeModel || null, to: vehicleMakeModel || null };
    }

    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }

    updateCredential.mutate({
      id: vehicle.id,
      vehiclePlate: vehiclePlate || null,
      vehicleMakeModel: vehicleMakeModel || null,
    }, {
      onSuccess: () => {
        logAuditAction('EMPLOYEE_UPDATE', {
          credential_id: vehicle.id,
          credential_type: 'vehicle',
          vehicle_plate: vehicle.vehiclePlate,
          changes,
        });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Editar Veículo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="text-sm text-muted-foreground">
            Proprietário: <span className="font-medium text-foreground">{vehicle.fullName}</span> — {vehicle.document}
          </div>

          <div className="space-y-2">
            <Label>Placa</Label>
            <Input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="Ex: ABC1D23"
              maxLength={7}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Marca / Modelo</Label>
            <Input
              value={vehicleMakeModel}
              onChange={(e) => setVehicleMakeModel(e.target.value.toUpperCase())}
              placeholder="Ex: GOL G5 PRATA"
            />
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

export default EditVehicleModal;
