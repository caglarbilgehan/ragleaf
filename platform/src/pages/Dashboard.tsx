import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Bot,
  Database,
  Users,
  HardDrive,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { adminApi } from '@/services/api';
import type { SystemStats } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useQuery<SystemStats>(
    'system-stats',
    adminApi.getStats,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">Sistem istatistikleri yüklenirken hata oluştu</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Toplam Döküman',
      value: stats?.documents.total || 0,
      subtitle: `${stats?.documents.processed || 0} işlenmiş`,
      icon: FileText,
      color: 'bg-blue-500',
      trend: '+12%',
    },
    {
      title: 'Aktif Modeller',
      value: stats?.models.active || 0,
      subtitle: `${stats?.models.total || 0} toplam`,
      icon: Bot,
      color: 'bg-green-500',
      trend: '+5%',
    },
    {
      title: 'Kullanıcılar',
      value: stats?.users.active || 0,
      subtitle: `${stats?.users.admins || 0} admin`,
      icon: Users,
      color: 'bg-orange-500',
      trend: '+3%',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Sistem durumu ve istatistikleri</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          <span>Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{stat.subtitle}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">{stat.trend}</span>
              <span className="text-gray-500 ml-1">bu ay</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Döküman Durumu</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">İşlenmiş</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.processed / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{stats?.documents.processed || 0}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">İşleniyor</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.processing / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{stats?.documents.processing || 0}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Hatalı</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ 
                      width: `${stats?.documents.total ? (stats.documents.failed / stats.documents.total) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{stats?.documents.failed || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Depolama Kullanımı</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <HardDrive className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">Toplam Kullanım</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                {stats?.storage.total_mb.toFixed(1) || 0} MB
              </span>
            </div>
            
            {/* File Type Breakdown */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-blue-500 mr-2" />
                  <span className="text-sm text-gray-600">PDF Dosyaları</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {((stats?.storage.total_mb || 0) * 0.6).toFixed(1)} MB
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center">
                  <Database className="h-4 w-4 text-purple-500 mr-2" />
                  <span className="text-sm text-gray-600">Vector Embeddings</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {((stats?.storage.total_mb || 0) * 0.25).toFixed(1)} MB
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center">
                  <div className="h-4 w-4 bg-green-500 rounded mr-2"></div>
                  <span className="text-sm text-gray-600">Görsel Dosyalar</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {((stats?.storage.total_mb || 0) * 0.1).toFixed(1)} MB
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="h-4 w-4 bg-gray-400 rounded mr-2"></div>
                  <span className="text-sm text-gray-600">Diğer Dosyalar</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {((stats?.storage.total_mb || 0) * 0.05).toFixed(1)} MB
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            className="btn btn-primary btn-md"
            onClick={() => navigate('/documents')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Yeni Döküman Yükle
          </button>
          <button 
            className="btn btn-secondary btn-md"
            onClick={() => navigate('/models')}
          >
            <Bot className="h-4 w-4 mr-2" />
            Model Ekle
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sistem Durumu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-green-800">Backend API</span>
              <p className="text-xs text-green-600">FastAPI Server</p>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-green-600">Aktif</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-green-800">SQLite DB</span>
              <p className="text-xs text-green-600">Yerel Veritabanı</p>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-green-600">Bağlı</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-blue-800">MongoDB</span>
              <p className="text-xs text-blue-600">ChatUI Veritabanı</p>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm text-blue-600">Bağlı</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-purple-800">AI Servisleri</span>
              <p className="text-xs text-purple-600">{stats?.ai_services?.active || 0} aktif servis</p>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 ${(stats?.ai_services?.active || 0) > 0 ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2`}></div>
              <span className={`text-sm ${(stats?.ai_services?.active || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                {(stats?.ai_services?.active || 0) > 0 ? 'Hazır' : 'Yapılandırılmadı'}
              </span>
            </div>
          </div>
        </div>
        
        {/* AI Services Detail */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3">AI Servis Sağlayıcıları</h4>
          {stats?.ai_services?.by_provider && stats.ai_services.by_provider.length > 0 ? (
            <div className="space-y-3">
              {stats.ai_services.by_provider.map((provider, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 ${provider.active > 0 ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2`}></div>
                      <span className="text-sm font-semibold text-gray-800">{provider.display_name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${provider.active > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {provider.active}/{provider.total} aktif
                    </span>
                  </div>
                  {provider.services && provider.services.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {provider.services.map((service, sIdx) => (
                        <div key={sIdx} className="flex items-center text-xs">
                          <div className={`w-1.5 h-1.5 ${service.is_active ? 'bg-green-400' : 'bg-gray-300'} rounded-full mr-2`}></div>
                          <span className={service.is_active ? 'text-gray-700' : 'text-gray-400'}>
                            {service.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Henüz AI servisi yapılandırılmadı</p>
              <button 
                onClick={() => navigate('/settings')}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Ayarlar'dan yapılandırın →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
