import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ConnectionErrorBoundary from "@/components/ConnectionErrorBoundary";
import { isSystemConfigured, hasEnvVars } from "@/pages/InstallWizard";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RegisterVisitor from "./pages/RegisterVisitor";
import VisitorList from "./pages/VisitorList";
import VisitorPass from "./pages/VisitorPass";
import QRScanner from "./pages/QRScanner";
import Settings from "./pages/Settings";
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
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: false,
    },
  },
});

// Protected route wrapper - redirects to wizard if not configured
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // If env vars are missing, redirect to wizard
  if (!hasEnvVars()) {
    return <Navigate to="/install-wizard" replace />;
  }
  
  return <>{children}</>;
};

// Wizard route wrapper - redirects to login if already configured
const WizardRoute = ({ children }: { children: React.ReactNode }) => {
  // If already fully configured, go to login
  if (isSystemConfigured()) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
          
          {/* Protected Routes - require configuration */}
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <ConnectionErrorBoundary>
                  <AuthProvider>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/register" element={<RegisterVisitor />} />
                      <Route path="/visitors" element={<VisitorList />} />
                      <Route path="/pass/:id" element={<VisitorPass />} />
                      <Route path="/scan" element={<QRScanner />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AuthProvider>
                </ConnectionErrorBoundary>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
