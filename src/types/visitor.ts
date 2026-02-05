export interface Visitor {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string;
  photo?: string;
  department: string;
  hostEmployee: string;
  purpose: string;
  validFrom: Date;
  validTill: Date;
  status: 'pending' | 'inside' | 'outside' | 'expired';
  checkInTime?: Date;
  checkOutTime?: Date;
  createdAt: Date;
  passId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'security' | 'employee';
}

export interface Department {
  id: string;
  name: string;
}

export const DEPARTMENTS: Department[] = [
  { id: '1', name: 'Produção' },
  { id: '2', name: 'Recursos Humanos' },
  { id: '3', name: 'TI' },
  { id: '4', name: 'Financeiro' },
  { id: '5', name: 'Comercial' },
  { id: '6', name: 'Logística' },
  { id: '7', name: 'Qualidade' },
  { id: '8', name: 'Manutenção' },
];
