import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ConnectionErrorBoundary from "@/components/ConnectionErrorBoundary";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import ProtectedRoute from "@/components/ProtectedRoute";
import { isSystemConfigured, hasEnvVars } from "@/pages/InstallWizard";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RegisterVisitor from "./pages/RegisterVisitor";
import RegisterEmployee from "./pages/RegisterEmployee";
import RegisterVehicle from "./pages/RegisterVehicle";
import EmployeeList from "./pages/EmployeeList";
import VehicleList from "./pages/VehicleList";
import VisitorList from "./pages/VisitorList";
import VisitorPass from "./pages/VisitorPass";
import CredentialPass from "./pages/CredentialPass";
import QRScanner from "./pages/QRScanner";
import ScanKiosk from "./pages/ScanKiosk";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import Reports from "./pages/Reports";
import InstallWizard from "./pages/InstallWizard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on network errors (server offline)
        if (error?.message?.includes('Failed to fetch') || 
            error?.message?.includes('NetworkError') ||
            error?.message?.includes('Network request failed')) {
          return false;
        }
        // Don't retry on 401/403 auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Wrapper para verificar se env vars existem antes de carregar AuthProvider
const EnvGuard = ({ children }: { children: React.ReactNode }) => {
  if (!hasEnvVars()) {
    return <Navigate to="/install-wizard" replace />;
  }
  return <>{children}</>;
};

// Wizard route wrapper - redirects to login if already configured
const WizardRoute = ({ children }: { children: React.ReactNode }) => {
  if (isSystemConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalErrorHandler />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Install Wizard - accessible when not configured */}
          <Route 
            path="/install-wizard" 
            element={
              <WizardRoute>
                <InstallWizard />
              </WizardRoute>
            } 
          />
          
          {/* Protected Routes - require env vars + authentication */}
          <Route 
            path="/*" 
            element={
              <EnvGuard>
                <ConnectionErrorBoundary>
                  <AuthProvider>
                    <Routes>
                      {/* Public routes (dentro do AuthProvider para ter acesso ao contexto) */}
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      
                      {/* Rotas públicas de passes (não requerem login) */}
                      <Route path="/pass/:id" element={<VisitorPass />} />
                      <Route path="/credential/:id" element={<CredentialPass />} />
                      
                      {/* Protected routes - requerem autenticação */}
                      <Route path="/dashboard" element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/register" element={
                        <ProtectedRoute requiredRoles={['admin', 'rh']}>
                          <RegisterVisitor />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/register/employee" element={
                        <ProtectedRoute requiredRoles={['admin', 'rh']}>
                          <RegisterEmployee />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/register/vehicle" element={
                        <ProtectedRoute requiredRoles={['admin', 'rh']}>
                          <RegisterVehicle />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/employees" element={
                        <ProtectedRoute>
                          <EmployeeList />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/vehicles" element={
                        <ProtectedRoute>
                          <VehicleList />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/visitors" element={
                        <ProtectedRoute>
                          <VisitorList />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/scan" element={
                        <ProtectedRoute>
                          <QRScanner />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/scan/kiosk" element={
                        <ProtectedRoute>
                          <ScanKiosk />
                        </ProtectedRoute>
                      } />
                      
                      {/* Admin routes */}
                      <Route path="/settings" element={
                        <ProtectedRoute requiredRoles={['admin']}>
                          <Settings />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/audit" element={
                        <ProtectedRoute requiredRoles={['admin']}>
                          <AuditLogs />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/reports" element={
                        <ProtectedRoute requiredRoles={['admin']}>
                          <Reports />
                        </ProtectedRoute>
                      } />
                      
                      {/* 404 */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AuthProvider>
                </ConnectionErrorBoundary>
              </EnvGuard>
            } 
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
