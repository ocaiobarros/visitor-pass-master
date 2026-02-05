import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Visitor } from '@/types/visitor';

interface VisitorContextType {
  visitors: Visitor[];
  addVisitor: (visitor: Omit<Visitor, 'id' | 'passId' | 'createdAt' | 'status'>) => Visitor;
  updateVisitorStatus: (id: string, status: Visitor['status'], time?: Date) => void;
  getVisitor: (id: string) => Visitor | undefined;
  getVisitorByPassId: (passId: string) => Visitor | undefined;
}

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

const generatePassId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'VP-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Dados de exemplo
const mockVisitors: Visitor[] = [
  {
    id: '1',
    name: 'João Silva',
    company: 'Tech Solutions Ltda',
    phone: '(11) 99999-1234',
    email: 'joao@techsolutions.com',
    department: 'TI',
    hostEmployee: 'Carlos Santos',
    purpose: 'Reunião técnica',
    validFrom: new Date(),
    validTill: new Date(Date.now() + 4 * 60 * 60 * 1000),
    status: 'inside',
    checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    passId: 'VP-ABC12345',
  },
  {
    id: '2',
    name: 'Maria Fernandes',
    company: 'Logística Express',
    phone: '(11) 98888-5678',
    department: 'Logística',
    hostEmployee: 'Pedro Lima',
    purpose: 'Entrega de materiais',
    validFrom: new Date(Date.now() - 5 * 60 * 60 * 1000),
    validTill: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'outside',
    checkInTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
    checkOutTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    passId: 'VP-DEF67890',
  },
  {
    id: '3',
    name: 'Roberto Almeida',
    company: 'Consultoria ABC',
    phone: '(11) 97777-9012',
    department: 'Financeiro',
    hostEmployee: 'Ana Costa',
    purpose: 'Auditoria mensal',
    validFrom: new Date(),
    validTill: new Date(Date.now() + 6 * 60 * 60 * 1000),
    status: 'pending',
    createdAt: new Date(),
    passId: 'VP-GHI11223',
  },
];

export const VisitorProvider = ({ children }: { children: ReactNode }) => {
  const [visitors, setVisitors] = useState<Visitor[]>(mockVisitors);

  const addVisitor = (visitorData: Omit<Visitor, 'id' | 'passId' | 'createdAt' | 'status'>): Visitor => {
    const newVisitor: Visitor = {
      ...visitorData,
      id: Date.now().toString(),
      passId: generatePassId(),
      createdAt: new Date(),
      status: 'pending',
    };
    setVisitors((prev) => [...prev, newVisitor]);
    return newVisitor;
  };

  const updateVisitorStatus = (id: string, status: Visitor['status'], time?: Date) => {
    setVisitors((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const updates: Partial<Visitor> = { status };
          if (status === 'inside' && time) updates.checkInTime = time;
          if (status === 'outside' && time) updates.checkOutTime = time;
          return { ...v, ...updates };
        }
        return v;
      })
    );
  };

  const getVisitor = (id: string) => visitors.find((v) => v.id === id);
  const getVisitorByPassId = (passId: string) => visitors.find((v) => v.passId === passId);

  return (
    <VisitorContext.Provider value={{ visitors, addVisitor, updateVisitorStatus, getVisitor, getVisitorByPassId }}>
      {children}
    </VisitorContext.Provider>
  );
};

export const useVisitors = () => {
  const context = useContext(VisitorContext);
  if (!context) {
    throw new Error('useVisitors must be used within a VisitorProvider');
  }
  return context;
};
