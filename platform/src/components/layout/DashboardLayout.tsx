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
  Lock,
  Mail,
  PhoneCall,
  Megaphone,
  ChevronDown,
  ShoppingBag,
  Calendar,
  Gift,
  Puzzle,
} from 'lucide-react';
import { authApi } from '@/services/api';
import { organizationApi, type Organization } from '@/services/ragleafApi';
import { useTranslation } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { getLogoUrl } from '@/utils/assets';
import type { User } from '@/types';
import NotificationBell from '@/components/NotificationBell';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export default function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'tenant'>('tenant');
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { language, setLanguage, t } = useTranslation();
  const isAdmin = user.is_superadmin || user.is_admin;

  // Load current organization details for feature gating
  useEffect(() => {
    if (!isAdmin || viewMode === 'tenant') {
      organizationApi.getCurrent()
        .then(setCurrentOrg)
        .catch(err => console.error('Failed to load current organization details:', err));
    }
  }, [viewMode, isAdmin]);

  // Auto-detect admin routes from URL and sync viewMode
  useEffect(() => {
    const adminPaths = ['/dashboard', '/admin/', '/models', '/system-monitor', '/backup', '/api-tokens', '/ai-providers', '/statistics', '/rag-', '/embedding/'];
    const isAdminRoute = adminPaths.some(p => location.pathname.startsWith(p));
    if (isAdmin && isAdminRoute && viewMode !== 'admin') {
      setViewMode('admin');
    }
  }, [location.pathname, isAdmin]);

  const adminNavigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.contacts'), href: '/admin/contacts', icon: MessageSquare },
    {
      name: t('nav.tenant_management'),
      href: '#',
      icon: Users,
      isHeader: true
    },
    { name: t('nav.tenants'), href: '/admin/tenants', icon: Users },
    {
      name: language === 'tr' ? 'Hazır Asistanlar' : 'Ready Assistants',
      href: '#',
      icon: Sparkles,
      isHeader: true
    },
    { name: language === 'tr' ? 'Sektörel Asistanlar' : 'Sectoral Assistants', href: '/admin/templates', icon: Sparkles },
    {
      name: t('nav.system'),
      href: '#',
      icon: Monitor,
      isHeader: true
    },
    { name: t('nav.plan_management'), href: '/admin/plans', icon: CreditCard },
    { name: t('nav.ai_providers'), href: '/ai-providers', icon: Zap },
    { name: t('nav.system_monitor'), href: '/system-monitor', icon: Monitor },
    { name: t('nav.backup'), href: '/backup', icon: HardDrive },
    { name: t('nav.api_tokens'), href: '/api-tokens', icon: Key },
    {
      name: t('nav.llm_management'),
      href: '#',
      icon: Bot,
      isHeader: true
    },
    { name: t('nav.llm_models'), href: '/models', icon: Bot },
    { name: t('nav.llm_stats'), href: '/statistics', icon: BarChart3 },
    {
      name: t('nav.embedding_management'),
      href: '#',
      icon: Database,
      isHeader: true
    },
    { name: t('nav.embedding_models'), href: '/embedding/models', icon: Package },
    {
      name: t('nav.rag_management'),
      href: '#',
      icon: Database,
      isHeader: true
    },
    { name: t('nav.rag_config'), href: '/admin/rag-config', icon: Settings },
  ];

  const tenantNavigation = [
    { name: t('nav.dashboard'), href: '/tenant', icon: LayoutDashboard },
    { name: t('nav.randevular'), href: '/tenant/appointments', icon: CalendarDays },
    { name: t('nav.takvim'), href: '/tenant/calendar', icon: Calendar },
    { name: t('nav.siparisler'), href: '/tenant/orders', icon: ShoppingBag },
    { name: t('nav.odemeler'), href: '/tenant/payments', icon: CreditCard },
    
    // AI Assistant Group
    {
      name: t('nav.yz_asistan'),
      href: '#',
      icon: Bot,
      isHeader: true
    },
    { name: t('nav.asistanlarim'), href: '/agents', icon: Bot, isLocked: currentOrg ? !currentOrg.has_ai_assistant : false },
    { name: t('nav.dokumanlar'), href: '/tenant/documents', icon: Upload, isLocked: currentOrg ? !currentOrg.has_ai_assistant : false },
    
    // AIchat Group
    {
      name: t('nav.aichat'),
      href: '#',
      icon: MessageSquare,
      isHeader: true
    },
    { name: t('nav.konusmalar'), href: '/tenant/conversations', icon: MessageSquare, isLocked: currentOrg ? !currentOrg.has_ai_assistant : false },
    { name: t('nav.widget_kodu'), href: '/tenant/widget', icon: Code, isLocked: currentOrg ? !currentOrg.has_ai_assistant : false },
    { name: t('nav.moduller'), href: '/tenant/modules', icon: Puzzle, isLocked: currentOrg ? !currentOrg.has_ai_assistant : false },
    
    // AI Writer Group
    {
      name: t('nav.yz_yazar'),
      href: '#',
      icon: Sparkles,
      isHeader: true
    },
    { name: t('nav.ai_blog_yazari'), href: '/tenant/writer', icon: Sparkles, isLocked: currentOrg ? !currentOrg.has_ai_writer : false },

    // AIautomation Group
    {
      name: t('nav.yz_otomasyon'),
      href: '#',
      icon: Zap,
      isHeader: true
    },
    { name: t('nav.otomasyon_senaryolari'), href: '/tenant/automations/scenarios', icon: Zap, isLocked: currentOrg ? !currentOrg.has_ai_social : false },
    
    // Management & Integration
    {
      name: t('nav.yonetim_entegrasyon'),
      href: '#',
      icon: Settings,
      isHeader: true
    },
    { name: t('nav.kullanicilar'), href: '/tenant/users', icon: Users },
    { name: t('nav.hesap_ayarlari'), href: '/tenant/account', icon: Settings },

    // AI Social Group (Coming Soon)
    {
      name: t('nav.yz_sosyal'),
      href: '#',
      icon: ArrowLeftRight,
      isHeader: true,
      isComingSoon: true
    },
    
    // AImail Group (Coming Soon)
    {
      name: t('nav.aimail'),
      href: '#',
      icon: Mail,
      isHeader: true,
      isComingSoon: true
    },
    
    // AIcall Group (Coming Soon)
    {
      name: t('nav.aicall'),
      href: '#',
      icon: PhoneCall,
      isHeader: true,
      isComingSoon: true
    },
    
    // AIpromotion Group (Coming Soon)
    {
      name: t('nav.aipromotion'),
      href: '#',
      icon: Megaphone,
      isHeader: true,
      isComingSoon: true
    },
  ];

  const navigation = viewMode === 'admin' ? adminNavigation : tenantNavigation;

  const handleViewSwitch = () => {
    const newMode = viewMode === 'admin' ? 'tenant' : 'admin';
    setViewMode(newMode);
    navigate(newMode === 'admin' ? '/dashboard' : '/tenant');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      toast.success(t('msg.logout_success'));
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
                    placeholder={t('nav.search_placeholder')}
                    type="search"
                  />
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Language Selector */}
              <div className="flex items-center gap-1 bg-dark-900 rounded-lg p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setLanguage('tr')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    language === 'tr'
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Türkçe"
                >
                  TR
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    language === 'en'
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="English"
                >
                  EN
                </button>
              </div>

              {/* Panel Switch (only for admins) */}
              {isAdmin && (
                <button
                  onClick={handleViewSwitch}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'tenant'
                      ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 ring-1 ring-amber-500/30'
                      : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                  }`}
                  title={viewMode === 'admin' ? t('nav.tenant_view') : t('nav.admin_panel')}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">
                    {viewMode === 'admin' ? t('nav.tenant_view') : t('nav.admin_panel')}
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
                  title={t('nav.logout')}
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
            <div className="w-full px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ navigation, currentPath }: { navigation: any[]; currentPath: string }) {
  const { t, language } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => {
      // Determine default expanded state if not explicitly toggled yet
      const isDefaultExpanded = name === activeHeaderName;
      const currentVal = prev[name] !== undefined ? prev[name] : isDefaultExpanded;
      return {
        ...prev,
        [name]: !currentVal,
      };
    });
  };

  // Find which header section is currently active based on sub-items active status
  let activeHeaderName = '';
  let lastHeaderName = '';
  for (const navItem of navigation) {
    if (navItem.isHeader) {
      lastHeaderName = navItem.name;
    } else {
      const isActive = navItem.href === '/tenant/writer'
        ? currentPath === '/tenant/writer'
        : currentPath === navItem.href || (navItem.href !== '/' && currentPath.startsWith(navItem.href));
      if (isActive) {
        activeHeaderName = lastHeaderName;
      }
    }
  }

  let currentSectionCollapsed = false;
  const mainNavigation = navigation.filter((item) => !item.isComingSoon);
  const comingSoonItems = navigation.filter((item) => item.isComingSoon);

  return (
    <div className="flex flex-col h-0 flex-1 border-r border-white/[0.06] bg-dark-800">
      {/* Logo */}
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <img src={getLogoUrl('dark')} alt="Ragleaf" className="h-8 w-8 mr-2" />
          <h1 className="text-xl font-bold text-gray-100">Ragleaf</h1>
        </div>

        {/* Navigation */}
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {mainNavigation.map((item) => {
            // Handle header items
            if ((item as any).isHeader) {
              const isComingSoon = !!item.isComingSoon;
              const isCollapsible = !isComingSoon;
              const isDefaultExpanded = item.name === activeHeaderName;
              const isExpanded = expandedSections[item.name] !== undefined ? expandedSections[item.name] : isDefaultExpanded;
              currentSectionCollapsed = !isExpanded;

              const match = item.name.match(/^(AI)(.*)$/);
              return (
                <div key={item.name} className="pt-5 pb-2 px-3">
                  <div
                    onClick={isCollapsible ? () => toggleSection(item.name) : undefined}
                    className={`flex items-center justify-between group/header ${
                      isCollapsible ? 'cursor-pointer select-none' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <item.icon className={`mr-3 h-5 w-5 transition-colors ${
                        isCollapsible ? 'text-gray-400 group-hover/header:text-gray-300' : 'text-gray-400'
                      }`} />
                      {match ? (
                        <div className="flex items-baseline">
                          <span className="text-primary-500 font-black text-[16px] tracking-normal">AI</span>
                          <span className="text-gray-200 font-bold normal-case text-[15px] ml-0.5">{match[2]}</span>
                        </div>
                      ) : (
                        <span className="text-gray-200 font-bold text-[15px]">{item.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isComingSoon && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-normal normal-case">
                          {t('nav.coming_soon')}
                        </span>
                      )}
                      {isCollapsible && (
                        <ChevronDown
                          className={`h-4 w-4 text-gray-500 group-hover/header:text-gray-300 transition-transform duration-200 ${
                            isExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                          }`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 border-t border-white/[0.04]"></div>
                </div>
              );
            }

            if (currentSectionCollapsed) {
              return null;
            }

            const isActive = item.href === '/tenant/writer'
              ? currentPath === '/tenant/writer'
              : currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={(item.isLocked || item.isComingSoon) ? '#' : item.href}
                onClick={(e) => {
                  if (item.isComingSoon) {
                    e.preventDefault();
                    toast(t('nav.coming_soon') + '!', {
                      icon: '🚀',
                      style: {
                        background: '#1F2937',
                        color: '#FFF',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }
                    });
                  } else if (item.isLocked) {
                    e.preventDefault();
                    toast('Bu premium modülü kullanabilmek için planınızı yükseltmeniz gerekmektedir.', {
                      icon: '🔒',
                      style: {
                        background: '#1F2937',
                        color: '#FFF',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }
                    });
                  }
                }}
                className={`group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                  ? 'bg-primary-500/10 text-primary-400 border-r-2 border-primary-500'
                  : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                  } ${item.isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${item.isComingSoon ? 'opacity-60 cursor-help' : ''}`}
              >
                <div className="flex items-center">
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-primary-500' : 'text-gray-500 group-hover:text-gray-400'
                      }`}
                  />
                  {item.name}
                </div>
                {item.isLocked && <Lock className="h-3.5 w-3.5 text-gray-500" />}
                {item.isComingSoon && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {t('nav.coming_soon')}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>



      {/* Coming Soon Sticky Container */}
      {comingSoonItems.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-dark-900/10 p-3.5">
          <div className="space-y-1.5">
            {comingSoonItems.map((item) => {
              const match = item.name.match(/^(AI)(.*)$/);
              let iconColorClass = "text-gray-500 group-hover:text-amber-400";
              if (item.name.toLowerCase().includes('social')) {
                iconColorClass = "text-gray-500 group-hover:text-pink-400 group-hover:drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]";
              } else if (item.name.toLowerCase().includes('mail')) {
                iconColorClass = "text-gray-500 group-hover:text-sky-400 group-hover:drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]";
              } else if (item.name.toLowerCase().includes('call')) {
                iconColorClass = "text-gray-500 group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]";
              } else if (item.name.toLowerCase().includes('promotion')) {
                iconColorClass = "text-gray-500 group-hover:text-amber-400 group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]";
              }
              return (
                <div
                  key={item.name}
                  onClick={() => {
                    toast(t('nav.coming_soon') + '!', {
                      icon: '🚀',
                      style: {
                        background: '#1F2937',
                        color: '#FFF',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }
                    });
                  }}
                  className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-dark-900/40 border border-white/[0.03] hover:border-white/[0.08] hover:bg-dark-900/60 cursor-pointer transition-all hover:translate-x-1 group active:scale-[0.99] duration-200"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 transition-all duration-300 ${iconColorClass}`} />
                    {match ? (
                      <div className="text-xs font-semibold flex items-baseline">
                        <span className="text-primary-500 font-bold">AI</span>
                        <span className="text-gray-300 font-medium normal-case ml-0.5 group-hover:text-white transition-colors">{match[2]}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 font-semibold group-hover:text-white transition-colors">{item.name}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full select-none">
                    {t('nav.coming_soon').toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
