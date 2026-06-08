import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useTranslation } from '@/contexts/LanguageContext';
import { 
  Activity,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStick,
  Info,
  Sliders,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SystemMonitorConfig {
  warning_memory_percent: number;
  critical_memory_percent: number;
  monitoring_active: boolean;
}

interface SystemStats {
  cpu_percent: number;
  cpu_temp: number | null;
  temperatures?: Array<{ label: string; value: number }>;
  memory: {
    total: number;
    available: number;
    percent: number;
    used: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  gpu?: {
    available: boolean;
    name?: string;
    memory_used?: number;
    memory_total?: number;
    memory_percent?: number;
    load?: number;
    temperature?: number;
  };
  hardware?: {
    cpu_model: string;
    cpu_cores: string;
    total_ram: number;
    os: string;
    python_version: string;
  };
  disks?: Array<{
    device: string;
    mountpoint: string;
    total: number;
    used: number;
    free: number;
    percent: number;
    label: string;
  }>;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SystemMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'monitor' | 'settings'>('monitor');
  const [config, setConfig] = useState<SystemMonitorConfig>({
    warning_memory_percent: 75,
    critical_memory_percent: 90,
    monitoring_active: true
  });
  const [stats, setStats] = useState<SystemStats | null>(null);
  
  // Loading states
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch configuration
  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const response = await api.get('/api/admin/settings/system_monitor_settings');
      if (response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error('Error fetching system monitor config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch real-time stats
  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/system/stats');
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching system stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Initial loads
  useEffect(() => {
    fetchConfig();
  }, []);

  // Poll system stats when monitor tab is active
  useEffect(() => {
    let interval: any;
    if (activeTab === 'monitor') {
      fetchStats();
      if (autoRefresh) {
        interval = setInterval(fetchStats, 5000);
      }
    }
    return () => clearInterval(interval);
  }, [activeTab, autoRefresh]);

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/admin/settings/system_monitor_settings', config);
      toast.success(t('admin.monitor.toast_save_success'));
    } catch (error) {
      toast.error(t('admin.monitor.toast_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  // Optimize Memory / Cleanup
  const handleOptimizeMemory = async () => {
    try {
      setOptimizing(true);
      const response = await api.post('/admin/system/cleanup-memory');
      if (response.data?.success) {
        toast.success(t('admin.monitor.toast_optimize_success'));
        fetchStats();
      } else {
        toast.error(t('admin.monitor.toast_optimize_failed'));
      }
    } catch (error) {
      toast.error(t('admin.monitor.toast_optimize_error'));
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('admin.monitor.title')}</h1>
          <p className="text-gray-500 text-sm">{t('admin.monitor.subtitle')}</p>
        </div>
        {activeTab === 'settings' && (
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2 self-start sm:self-auto bg-primary-600 hover:bg-primary-700">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('admin.monitor.save_btn')}
          </Button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-white/[0.06] gap-2">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'monitor'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          {t('admin.monitor.tab_monitor')}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          {t('admin.monitor.tab_settings')}
        </button>
      </div>

      {/* MONITOR TAB */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-dark-800/40 p-4 rounded-xl border border-white/[0.04] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-400">{t('admin.monitor.auto_refresh')}</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={fetchStats} 
                disabled={loadingStats}
                className="border-white/[0.06] hover:bg-dark-700 text-gray-300"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
                {t('admin.monitor.refresh_btn')}
              </Button>
              <Button 
                onClick={handleOptimizeMemory} 
                disabled={optimizing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
              >
                <Sparkles className={`h-4 w-4 ${optimizing ? 'animate-spin' : ''}`} />
                {optimizing ? t('admin.monitor.optimizing_btn') : t('admin.monitor.optimize_btn')}
              </Button>
            </div>
          </div>

          {loadingStats && !stats ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
              <p className="text-sm text-gray-500">{t('admin.monitor.loading_stats')}</p>
            </div>
          ) : stats ? (
            <>
              {/* Hardware Specifications */}
              {stats.hardware && (
                <Card className="bg-dark-800/50 border-white/[0.06] mb-6">
                  <CardHeader>
                    <CardTitle className="text-gray-100 flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-primary-400" />
                      {t('admin.monitor.hw_specs_title')}
                    </CardTitle>
                    <CardDescription>{t('admin.monitor.hw_specs_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_cpu_model')}</span>
                        <span className="text-gray-200 font-medium">{stats.hardware.cpu_model}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_cpu_cores')}</span>
                        <span className="text-gray-200 font-medium">{stats.hardware.cpu_cores}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_total_ram')}</span>
                        <span className="text-gray-200 font-medium">{formatBytes(stats.hardware.total_ram)}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_os')}</span>
                        <span className="text-gray-200 font-medium">{stats.hardware.os}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_python_version')}</span>
                        <span className="text-gray-200 font-medium">{stats.hardware.python_version}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-500 block">{t('admin.monitor.hw_gpu_hardware')}</span>
                        <span className="text-gray-200 font-medium flex items-center gap-2">
                          <span>NVIDIA GeForce GTX 1050 (4GB)</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {t('admin.monitor.hw_gpu_not_connected')}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* CPU usage card */}
                <Card className="bg-dark-800/40 border-white/[0.06] rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">{t('admin.monitor.usage_cpu')}</CardTitle>
                    <Cpu className="h-4 w-4 text-primary-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-100">{stats.cpu_percent.toFixed(1)}%</div>
                    <div className="w-full bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                      <div className="bg-primary-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.cpu_percent}%` }}></div>
                    </div>
                  </CardContent>
                </Card>

                {/* RAM usage card */}
                <Card className="bg-dark-800/40 border-white/[0.06] rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">{t('admin.monitor.usage_ram')}</CardTitle>
                    <MemoryStick className="h-4 w-4 text-primary-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-100">{stats.memory.percent.toFixed(1)}%</div>
                    <div className="w-full bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                      <div className="bg-primary-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.memory.percent}%` }}></div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{t('admin.monitor.used')} {formatBytes(stats.memory.used)}</span>
                      <span>{t('admin.monitor.total')} {formatBytes(stats.memory.total)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Disk usage card */}
                <Card className="bg-dark-800/40 border-white/[0.06] rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">{t('admin.monitor.usage_disk')}</CardTitle>
                    <HardDrive className="h-4 w-4 text-primary-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-100">{stats.disk.percent.toFixed(1)}%</div>
                    <div className="w-full bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                      <div className="bg-primary-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.disk.percent}%` }}></div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{t('admin.monitor.used')} {formatBytes(stats.disk.used)}</span>
                      <span>{t('admin.monitor.total')} {formatBytes(stats.disk.total)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* GPU (optional) usage card */}
                <Card className="bg-dark-800/40 border-white/[0.06] rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">{t('admin.monitor.usage_gpu')}</CardTitle>
                    <Cpu className="h-4 w-4 text-primary-400" />
                  </CardHeader>
                  <CardContent>
                    {stats.gpu?.available ? (
                      <>
                        <div className="text-3xl font-bold text-gray-100">{(stats.gpu.load || 0).toFixed(1)}%</div>
                        <div className="w-full bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                          <div className="bg-primary-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.gpu.load || 0}%` }}></div>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 text-sm mt-2">{t('admin.monitor.no_data')}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Disk Volumes and Temperatures */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Disk volumes */}
                {stats.disks && (
                  <Card className="bg-dark-800/50 border-white/[0.06]">
                    <CardHeader>
                      <CardTitle className="text-gray-100 text-sm font-semibold">{t('admin.monitor.disk_volumes_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm text-left text-gray-300">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-gray-500 text-xs">
                            <th className="pb-2">{t('admin.monitor.disk_device')}</th>
                            <th className="pb-2">{t('admin.monitor.disk_mount')}</th>
                            <th className="pb-2">{t('admin.monitor.disk_total')}</th>
                            <th className="pb-2">{t('admin.monitor.disk_used')}</th>
                            <th className="pb-2">{t('admin.monitor.disk_free')}</th>
                            <th className="pb-2">{t('admin.monitor.disk_usage')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.disks.map((d, i) => (
                            <tr key={i} className="border-b border-white/[0.04]">
                              <td className="py-2 text-gray-100 font-medium">{d.device}</td>
                              <td className="py-2 font-mono text-xs">{d.mountpoint}</td>
                              <td className="py-2">{formatBytes(d.total)}</td>
                              <td className="py-2">{formatBytes(d.used)}</td>
                              <td className="py-2">{formatBytes(d.free)}</td>
                              <td className="py-2">
                                <span className="font-semibold text-gray-200">{d.percent.toFixed(1)}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}

                {/* Sensors */}
                {stats.temperatures && (
                  <Card className="bg-dark-800/50 border-white/[0.06]">
                    <CardHeader>
                      <CardTitle className="text-gray-100 text-sm font-semibold">{t('admin.monitor.temperatures_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.temperatures.map((t, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-white/[0.04] pb-2">
                            <span className="text-gray-400">{t.label}</span>
                            <span className="text-gray-100 font-medium">{t.value.toFixed(1)}°C</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">{t('admin.monitor.no_data')}</div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <Card className="bg-dark-800/50 border-white/[0.06]">
            <CardHeader>
              <CardTitle className="text-gray-100">{t('admin.monitor.settings_card_title')}</CardTitle>
              <CardDescription>{t('admin.monitor.settings_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Active Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                <div>
                  <Label className="text-gray-200 text-sm font-semibold">{t('admin.monitor.settings_active_label')}</Label>
                  <p className="text-xs text-gray-500 mt-1">{t('admin.monitor.settings_active_hint')}</p>
                </div>
                <Switch 
                  checked={config.monitoring_active} 
                  onCheckedChange={(checked) => setConfig({ ...config, monitoring_active: checked })} 
                />
              </div>

              {/* RAM Warning */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm font-semibold">{t('admin.monitor.settings_warning_label')}</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={config.warning_memory_percent}
                  onChange={(e) => setConfig({ ...config, warning_memory_percent: Number(e.target.value) })}
                  className="bg-dark-700/50 border-white/[0.1] text-gray-100"
                />
                <p className="text-xs text-gray-500">{t('admin.monitor.settings_warning_hint')}</p>
              </div>

              {/* RAM Critical */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm font-semibold">{t('admin.monitor.settings_critical_label')}</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={config.critical_memory_percent}
                  onChange={(e) => setConfig({ ...config, critical_memory_percent: Number(e.target.value) })}
                  className="bg-dark-700/50 border-white/[0.1] text-gray-100"
                />
                <p className="text-xs text-gray-500">{t('admin.monitor.settings_critical_hint')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Switch custom wrapper since rad-ui uses normal HTML switch
const Switch = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`${
        checked ? 'bg-primary-600' : 'bg-dark-600'
      } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800`}
    >
      <span
        className={`${
          checked ? 'translate-x-5' : 'translate-x-0'
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  );
};

export default SystemMonitorPage;
