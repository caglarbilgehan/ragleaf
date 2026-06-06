import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { 
  Activity,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStick,
  Info
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SystemMonitorConfig {
  warning_memory_percent: number;
  critical_memory_percent: number;
  monitoring_active: boolean;
}

const SystemMonitorPage: React.FC = () => {
  const [config, setConfig] = useState<SystemMonitorConfig>({
    warning_memory_percent: 75,
    critical_memory_percent: 90,
    monitoring_active: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/settings/system_monitor_settings');
      if (response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error('Error fetching system monitor config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/admin/settings/system_monitor_settings', config);
      toast.success('Sistem izleme ayarları kaydedildi');
    } catch (error) {
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Sistem İzleme</h1>
          <p className="text-gray-600">Sistem kaynak kullanımı izleme ve uyarı eşiklerini yapılandırın</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </Button>
      </div>

      {/* Memory Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MemoryStick className="h-5 w-5" />
            Bellek İzleme
          </CardTitle>
          <CardDescription>Sistem bellek kullanımı uyarı eşikleri</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg">
            <div>
              <Label className="font-medium">İzleme Aktif</Label>
              <p className="text-sm text-gray-500">Sistem kaynaklarını izle ve uyarı ver</p>
            </div>
            <Switch
              checked={config.monitoring_active}
              onCheckedChange={(checked) => setConfig({ ...config, monitoring_active: checked })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="warning_memory" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Uyarı Eşiği (%)
              </Label>
              <Input
                id="warning_memory"
                type="number"
                min="0"
                max="100"
                value={config.warning_memory_percent}
                onChange={(e) => setConfig({ ...config, warning_memory_percent: parseInt(e.target.value) || 75 })}
              />
              <p className="text-xs text-gray-500">
                Bu yüzdeye ulaşıldığında uyarı verilir
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="critical_memory" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Kritik Eşik (%)
              </Label>
              <Input
                id="critical_memory"
                type="number"
                min="0"
                max="100"
                value={config.critical_memory_percent}
                onChange={(e) => setConfig({ ...config, critical_memory_percent: parseInt(e.target.value) || 90 })}
              />
              <p className="text-xs text-gray-500">
                Bu yüzdeye ulaşıldığında kritik uyarı verilir
              </p>
            </div>
          </div>

          {/* Visual Indicator */}
          <div className="mt-4">
            <Label className="mb-2 block">Eşik Görselleştirme</Label>
            <div className="relative h-8 bg-dark-500 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-green-500 transition-all"
                style={{ width: `${config.warning_memory_percent}%` }}
              />
              <div 
                className="absolute top-0 h-full bg-yellow-500 transition-all"
                style={{ 
                  left: `${config.warning_memory_percent}%`,
                  width: `${config.critical_memory_percent - config.warning_memory_percent}%`
                }}
              />
              <div 
                className="absolute top-0 h-full bg-red-500 transition-all"
                style={{ 
                  left: `${config.critical_memory_percent}%`,
                  width: `${100 - config.critical_memory_percent}%`
                }}
              />
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-medium text-white">
                <span>Normal</span>
                <span>Uyarı</span>
                <span>Kritik</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0%</span>
              <span>{config.warning_memory_percent}%</span>
              <span>{config.critical_memory_percent}%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-400">
            <Info className="h-5 w-5" />
            Sistem İzleme Hakkında
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-300 space-y-2">
          <p>
            <strong>Uyarı Eşiği:</strong> Bellek kullanımı bu seviyeye ulaştığında sistem uyarı verir. 
            İşlemler yavaşlayabilir.
          </p>
          <p>
            <strong>Kritik Eşik:</strong> Bellek kullanımı bu seviyeye ulaştığında kritik uyarı verilir. 
            Yeni işlemler başlatılmayabilir.
          </p>
          <p className="mt-3 text-blue-400">
            💡 <strong>Önerilen:</strong> Uyarı: %75, Kritik: %90
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemMonitorPage;
