import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  QrCode,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { getPageTitle } from '@/config/branding';

interface DashboardLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/register', label: 'Registrar Visitante', icon: UserPlus, roles: ['admin', 'rh'] },
  { href: '/visitors', label: 'Lista de Visitantes', icon: Users },
  { href: '/scan', label: 'Scanner QR', icon: QrCode },
  { href: '/settings', label: 'Configurações', icon: Settings, roles: ['admin'] },
];

const DashboardLayout = ({ children, pageTitle }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Set page title dynamically
  useEffect(() => {
    document.title = getPageTitle(pageTitle);
  }, [pageTitle]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
          <nav className="p-4 space-y-1 border-t border-border bg-card">
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
            <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3 text-destructive">
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
