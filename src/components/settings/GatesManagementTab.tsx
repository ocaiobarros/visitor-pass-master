import { useState } from 'react';
import { useGates, useCreateGate, useUpdateGate, useDeleteGate } from '@/hooks/useGates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DoorOpen, Plus, Trash2, Pencil } from 'lucide-react';

const GatesManagementTab = () => {
  const { data: gates, isLoading } = useGates();
  const createGate = useCreateGate();
  const updateGate = useUpdateGate();
  const deleteGate = useDeleteGate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGate, setEditingGate] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const resetForm = () => {
    setForm({ code: '', name: '', description: '' });
    setEditingGate(null);
  };

  const handleCreate = () => {
    if (!form.code || !form.name) return;
    createGate.mutate(form, {
      onSuccess: () => { resetForm(); setIsCreateOpen(false); },
    });
  };

  const handleUpdate = () => {
    if (!editingGate || !form.name) return;
    updateGate.mutate({ id: editingGate, code: form.code, name: form.name, description: form.description || undefined }, {
      onSuccess: () => resetForm(),
    });
  };

  const startEdit = (gate: any) => {
    setEditingGate(gate.id);
    setForm({ code: gate.code, name: gate.name, description: gate.description || '' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="w-5 h-5" />
              Gerenciar Guaritas / Portões
            </CardTitle>
            <CardDescription>
              Cadastre e gerencie os portões de acesso da unidade
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Guarita
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Guarita</DialogTitle>
                <DialogDescription>Adicione um novo ponto de controle de acesso</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input placeholder="Ex: PORTAO_LESTE" value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Portão Leste" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input placeholder="Descrição do portão" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.code || !form.name || createGate.isPending}>
                  {createGate.isPending ? 'Criando...' : 'Criar Guarita'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !gates?.length ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma guarita cadastrada</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gates.map(gate => (
                  <TableRow key={gate.id}>
                    {editingGate === gate.id ? (
                      <>
                        <TableCell>
                          <Input value={form.code} className="w-32"
                            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))} />
                        </TableCell>
                        <TableCell>
                          <Input value={form.name} className="w-40"
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Input value={form.description} className="w-48"
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={gate.isActive ? 'default' : 'secondary'}>
                            {gate.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={handleUpdate} disabled={updateGate.isPending}>Salvar</Button>
                            <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-mono text-sm">{gate.code}</TableCell>
                        <TableCell className="font-medium">{gate.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{gate.description || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={gate.isActive}
                              onCheckedChange={(checked) => updateGate.mutate({ id: gate.id, is_active: checked })}
                            />
                            <Badge variant={gate.isActive ? 'default' : 'secondary'}>
                              {gate.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEdit(gate)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir guarita?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A guarita "{gate.name}" será removida. Registros existentes manterão o histórico.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteGate.mutate({ id: gate.id, name: gate.name })}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GatesManagementTab;
