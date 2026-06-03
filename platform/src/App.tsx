import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from '@/pages/LoginPage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import ModelsPage from '@/pages/ModelsPage';
import StatisticsPage from './pages/StatisticsPage';
// AI Services Pages
import AIProvidersPage from './pages/AIProvidersPage';
import APITokensPage from './pages/APITokensPage';
// System Monitor
import SystemMonitorPage from './pages/SystemMonitorPage';
// Embedding Management Pages
import EmbeddingModelsPage from './pages/embedding/EmbeddingModelsPage';
import BackupPage from './pages/BackupPage';
// Metadata Management Pages
import CategoriesPage from './pages/CategoriesPage';
import TagsPage from './pages/TagsPage';
// Agentik Platform Pages
import AgentsPage from './pages/AgentsPage';
import AgentBuilderPage from './pages/AgentBuilderPage';
import TemplateWizardPage from './pages/TemplateWizardPage';
import IntegrationPage from './pages/IntegrationPage';
// Tenant Pages
import TenantDashboard from './pages/tenant/TenantDashboard';
import TenantConversations from './pages/tenant/TenantConversations';
import TenantWidget from './pages/tenant/TenantWidget';
import TenantDocuments from './pages/tenant/TenantDocuments';
import TenantUsers from './pages/tenant/TenantUsers';
import TenantAppointments from './pages/tenant/TenantAppointments';
// Admin Pages
import TenantsPage from './pages/admin/TenantsPage';
import TenantDetailPage from './pages/admin/TenantDetailPage';
import TemplateManagementPage from './pages/admin/TemplateManagementPage';
import AIConfigPage from './pages/admin/AIConfigPage';
import { authApi } from '@/services/api';
import type { User } from '@/types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if token was passed via URL (cross-domain login from landing page)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('ragleaf_token', urlToken);
        // Clean URL (remove token param)
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      const token = localStorage.getItem('ragleaf_token');
      if (token) {
        try {
          const userData = await authApi.getCurrentUser();
          // Allow access for: superadmins, admins, or org members (tenants)
          if (userData.is_admin || userData.is_superadmin || userData.default_org_id) {
            setUser(userData);
          } else {
            localStorage.removeItem('ragleaf_token');
            localStorage.removeItem('ragleaf_user');
          }
        } catch (error) {
          localStorage.removeItem('ragleaf_token');
          localStorage.removeItem('ragleaf_user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Determine default path based on role
  const isAdmin = user.is_admin || user.is_superadmin;
  const defaultPath = '/tenant';

  return (
    <DashboardLayout user={user} onLogout={() => setUser(null)}>
      <Routes>
        {/* Admin Routes */}
        <Route path="/" element={<Navigate to="/tenant" replace />} />
        <Route path="/dashboard" element={isAdmin ? <Dashboard /> : <Navigate to="/tenant" replace />} />
        <Route path="/admin/tenants" element={isAdmin ? <TenantsPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/admin/tenants/:tenantId" element={isAdmin ? <TenantDetailPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/admin/templates" element={isAdmin ? <TemplateManagementPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/admin/ai-config" element={isAdmin ? <AIConfigPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/models" element={isAdmin ? <ModelsPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/system-monitor" element={isAdmin ? <SystemMonitorPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/backup" element={isAdmin ? <BackupPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/statistics" element={isAdmin ? <StatisticsPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/ai-providers" element={isAdmin ? <AIProvidersPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/api-tokens" element={isAdmin ? <APITokensPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/embedding/models" element={isAdmin ? <EmbeddingModelsPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/categories" element={isAdmin ? <CategoriesPage /> : <Navigate to="/tenant" replace />} />
        <Route path="/tags" element={isAdmin ? <TagsPage /> : <Navigate to="/tenant" replace />} />

        {/* Shared Routes */}
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/new/template" element={<TemplateWizardPage />} />
        <Route path="/agents/:agentId/edit" element={<AgentBuilderPage />} />
        <Route path="/agents/:agentId/integrate" element={<IntegrationPage />} />

        {/* Tenant Routes */}
        <Route path="/tenant" element={<TenantDashboard />} />
        <Route path="/tenant/conversations" element={<TenantConversations />} />
        <Route path="/tenant/widget" element={<TenantWidget />} />
        <Route path="/tenant/documents" element={<TenantDocuments />} />
        <Route path="/tenant/users" element={<TenantUsers />} />
        <Route path="/tenant/appointments" element={<TenantAppointments />} />

        <Route path="/login" element={<Navigate to={defaultPath} replace />} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export default App;
