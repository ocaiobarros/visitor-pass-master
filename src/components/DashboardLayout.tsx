import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Car,
  QrCode,
  LogOut,
  Menu,
  X,
  Settings,
  ClipboardList,
  ChevronDown,
  Loader2,
  FileText,
  FileBarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { getPageTitle } from '@/config/branding';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface DashboardLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/visitors', label: 'Visitantes', icon: ClipboardList },
  { href: '/employees', label: 'Funcionários', icon: Users },
  { href: '/vehicles', label: 'Veículos', icon: Car },
  { href: '/scan', label: 'Scanner QR', icon: QrCode },
  { href: '/audit', label: 'Auditoria', icon: FileText, roles: ['admin'] },
  { href: '/reports', label: 'Relatórios', icon: FileBarChart, roles: ['admin'] },
  { href: '/settings', label: 'Configurações', icon: Settings, roles: ['admin'] },
];

const registerItems = [
  { href: '/register', label: 'Visitante', icon: UserPlus },
  { href: '/register/employee', label: 'Funcionário', icon: Users },
  { href: '/register/vehicle', label: 'Veículo', icon: Car },
];

const DashboardLayout = ({ children, pageTitle }: DashboardLayoutProps) => {
  const { user, logout, isLoading, isAuthenticated, isAdminOrRh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [registerMenuOpen, setRegisterMenuOpen] = useState(false);

  // Set page title dynamically
  useEffect(() => {
    document.title = getPageTitle(pageTitle);
  }, [pageTitle]);

  // Redirect to login if not authenticated and not loading
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 sidebar-gradient text-sidebar-foreground">
        <div className="p-6 border-b border-sidebar-border">
          <BrandLogo 
            size="md" 
            showName={true}
            nameClassName="text-sidebar-foreground"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems
            .filter((item) => !item.roles || item.roles.some((role) => user?.roles?.includes(role as any)))
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

          {/* Register Menu (collapsible) - Only for Admin/RH */}
          {isAdminOrRh && (
            <Collapsible open={registerMenuOpen} onOpenChange={setRegisterMenuOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex items-center justify-between w-full gap-3 px-4 py-3 rounded-lg transition-colors',
                    location.pathname.startsWith('/register')
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-5 h-5" />
                    <span className="font-medium">Cadastrar</span>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', registerMenuOpen && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {registerItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium">{user?.fullName?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName || 'Usuário'}</p>
              <p className="text-xs text-sidebar-foreground/70 truncate capitalize">
                {user?.roles?.[0] || 'Segurança'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/70 hover:text-sidebar-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <BrandLogo size="sm" showName={true} />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="p-4 space-y-1 border-t border-border bg-card max-h-[70vh] overflow-auto">
            {navItems
              .filter((item) => !item.roles || item.roles.some((role) => user?.roles?.includes(role as any)))
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

            {/* Mobile Register Links */}
            {isAdminOrRh && (
              <div className="pt-2 border-t border-border mt-2">
                <p className="text-xs text-muted-foreground px-4 py-2">CADASTRAR</p>
                {registerItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3 text-destructive mt-2">
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </Button>
          </nav>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
