export type AppRole = 'admin' | 'rh' | 'security';
export type VisitorStatus = 'pending' | 'inside' | 'outside' | 'closed';
export type CredentialType = 'personal' | 'vehicle';
export type CredentialStatus = 'allowed' | 'blocked';
export type AccessDirection = 'in' | 'out';
export type SubjectType = 'visitor' | 'employee';
export type VisitToType = 'setor' | 'pessoa';
export type VisitorAccessType = 'pedestrian' | 'driver';

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: AppRole[];
}

export interface Department {
  id: string;
  name: string;
}

export interface Visitor {
  id: string;
  passId: string;
  fullName: string;
  document: string;
  company?: string;
  phone?: string;
  photoUrl?: string;
  visitToType: VisitToType;
  visitToName: string;
  gateObs?: string;
  companyReason: string;
  accessType: VisitorAccessType;
  vehiclePassId?: string;
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  validFrom: Date;
  validUntil: Date;
  status: VisitorStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCredential {
  id: string;
  credentialId: string;
  type: CredentialType;
  fullName: string;
  document: string;
  departmentId?: string;
  department?: Department;
  jobTitle?: string;
  photoUrl?: string;
  vehicleMakeModel?: string;
  vehiclePlate?: string;
  status: CredentialStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessLog {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  direction: AccessDirection;
  gateId: string;
  operatorId?: string;
  createdAt: Date;
}

// Helper para verificar permissões
export const canManageVisitors = (roles: AppRole[]): boolean => {
  return roles.includes('admin') || roles.includes('rh');
};

export const canManageCredentials = (roles: AppRole[]): boolean => {
  return roles.includes('admin') || roles.includes('rh');
};

export const canScan = (roles: AppRole[]): boolean => {
  return roles.includes('admin') || roles.includes('rh') || roles.includes('security');
};
