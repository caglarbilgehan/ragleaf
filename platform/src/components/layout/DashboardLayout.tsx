import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  Users,
  Menu,
  X,
  LogOut,
  Search,
  BarChart3,
  Database,
  Package,
  Zap,
  Monitor,
  Sparkles,
  HardDrive,
  Key,
  MessageSquare,
  Code,
  Upload,
  Settings,
  ArrowLeftRight,
  Shield,
  CalendarDays,
  CreditCard,
} from 'lucide-react';
import { authApi } from '@/services/api';
import toast from 'react-hot-toast';
import { getLogoUrl } from '@/utils/assets';
import type { User } from '@/types';
import NotificationBell from '@/components/NotificationBell';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const adminNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Tenant Yönetimi',
    href: '#',
    icon: Users,
    isHeader: true
  },
  { name: 'Tenantlar', href: '/admin/tenants', icon: Users },
  { name: 'Hazır Asistanlar', href: '/admin/templates', icon: Sparkles },
  { name: 'İletişim Talepleri', href: '/admin/contacts', icon: MessageSquare },
  {
    name: 'Sistem',
    href: '#',
    icon: Monitor,
    isHeader: true
  },
  { name: 'Plan Yönetimi', href: '/admin/plans', icon: CreditCard },
  { name: 'AI Providers', href: '/ai-providers', icon: Zap },
  { name: 'Sistem İzleme', href: '/system-monitor', icon: Monitor },
  { name: 'Yedekleme', href: '/backup', icon: HardDrive },
  { name: 'API Tokenları', href: '/api-tokens', icon: Key },
  {
    name: 'LLM Yönetimi',
    href: '#',
    icon: Bot,
    isHeader: true
  },
  { name: 'LLM Yapılandırması', href: '/admin/llm-config', icon: Settings },
  { name: 'LLM Modelleri', href: '/models', icon: Bot },
  { name: 'LLM İstatistikleri', href: '/statistics', icon: BarChart3 },
  {
    name: 'Embedding Yönetimi',
    href: '#',
    icon: Database,
    isHeader: true
  },
  { name: 'Embedding Modelleri', href: '/embedding/models', icon: Package },
  {
    name: 'RAG Yönetimi',
    href: '#',
    icon: Database,
    isHeader: true
  },
  { name: 'RAG Ayarları', href: '/admin/rag-config', icon: Settings },
];

const tenantNavigation = [
  { name: 'Dashboard', href: '/tenant', icon: LayoutDashboard },
  {
    name: 'Yönetim',
    href: '#',
    icon: Bot,
    isHeader: true
  },
  { name: 'Asistanlarım', href: '/agents', icon: Bot },
  { name: 'AI Yazar', href: '/tenant/writer', icon: Sparkles },
  { name: 'Randevular', href: '/tenant/appointments', icon: CalendarDays },
  { name: 'Dokümanlar', href: '/tenant/documents', icon: Upload },
  { name: 'Konuşmalar', href: '/tenant/conversations', icon: MessageSquare },
  { name: 'Kullanıcılar', href: '/tenant/users', icon: Users },
  {
    name: 'Entegrasyon',
    href: '#',
    icon: Code,
    isHeader: true
  },
  { name: 'Widget Kodu', href: '/tenant/widget', icon: Code },
];

function getNavigation(user: User) {
  if (user.is_superadmin || user.is_admin) {
    return adminNavigation;
  }
  return tenantNavigation;
}

export default function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'tenant'>('tenant');
  const location = useLocation();
  const navigate = useNavigate();
  
  const isAdmin = user.is_superadmin || user.is_admin;

  // Auto-detect admin routes from URL and sync viewMode
  useEffect(() => {
    const adminPaths = ['/dashboard', '/admin/', '/models', '/system-monitor', '/backup', '/api-tokens', '/ai-providers', '/statistics', '/rag-', '/embedding/'];
    const isAdminRoute = adminPaths.some(p => location.pathname.startsWith(p));
    if (isAdmin && isAdminRoute && viewMode !== 'admin') {
      setViewMode('admin');
    }
  }, [location.pathname, isAdmin]);

  const navigation = viewMode === 'admin' ? adminNavigation : tenantNavigation;

  const handleViewSwitch = () => {
    const newMode = viewMode === 'admin' ? 'tenant' : 'admin';
    setViewMode(newMode);
    navigate(newMode === 'admin' ? '/dashboard' : '/tenant');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      toast.success('Başarıyla çıkış yapıldı');
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      onLogout(); // Force logout even if API call fails
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-dark-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-dark-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent navigation={navigation} currentPath={location.pathname} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent navigation={navigation} currentPath={location.pathname} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-dark-800/80 backdrop-blur-md border-b border-white/[0.06]">
          <button
            className="px-4 border-r border-white/[0.06] text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-4 flex justify-between items-center">
            {/* Search bar */}
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full text-gray-500 focus-within:text-gray-300 max-w-lg">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent"
                    placeholder="Ara..."
                    type="search"
                  />
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Panel Switch (only for admins) */}
              {isAdmin && (
                <button
                  onClick={handleViewSwitch}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'tenant'
                      ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 ring-1 ring-amber-500/30'
                      : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                  }`}
                  title={viewMode === 'admin' ? 'Müşteri Paneline Geç' : 'Yönetim Paneline Dön'}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">
                    {viewMode === 'admin' ? 'Müşteri Görünümü' : 'Yönetim Paneli'}
                  </span>
                  {viewMode === 'tenant' && (
                    <Shield className="h-3 w-3 text-amber-500" />
                  )}
                </button>
              )}

              {/* Notifications */}
              <NotificationBell />

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="text-sm font-medium text-gray-200">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded-full text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-800 focus:ring-primary-500 transition-colors"
                  title="Çıkış Yap"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ navigation, currentPath }: { navigation: any[]; currentPath: string }) {
  return (
    <div className="flex flex-col h-0 flex-1 border-r border-white/[0.06] bg-dark-800">
      {/* Logo */}
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <span className="text-2xl mr-2">🍃</span>
          <h1 className="text-xl font-bold text-gray-100">Ragleaf</h1>
        </div>

        {/* Navigation */}
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            // Handle header items
            if ((item as any).isHeader) {
              return (
                <div key={item.name} className="pt-4 pb-2 px-3">
                  <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </div>
                  <div className="mt-1 border-t border-white/[0.06]"></div>
                </div>
              );
            }

            const isActive = currentPath === item.href ||
              (item.href !== '/' && currentPath.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                  ? 'bg-primary-500/10 text-primary-400 border-r-2 border-primary-500'
                  : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                  }`}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-primary-500' : 'text-gray-500 group-hover:text-gray-400'
                    }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex border-t border-white/[0.06] p-4">
        <div className="text-xs text-gray-600 text-center w-full">
          © 2026 Ragleaf
        </div>
      </div>
    </div>
  );
}
