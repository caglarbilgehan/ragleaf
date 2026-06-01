import { useState, useEffect } from 'react';
import { X, Save, User, Building2 } from 'lucide-react';
import type { User as UserType } from '@/types';

// Standard departments
const DEPARTMENTS = [
  'Teknik Servis',
  'Proje',
  'Uygulama',
  'Arge',
  'Satış',
  'Muhasebe',
  'Müşteri Hizmetleri'
];

interface EditUserModalProps {
  user: UserType;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export default function EditUserModal({
  user,
  onClose,
  onSubmit,
  isLoading = false,
}: EditUserModalProps) {
  const [formData, setFormData] = useState({
    email: user.email || '',
    name: user.name || '',
    surname: user.surname || '',
    password: '',
    is_active: user.is_active,
    is_admin: user.is_admin,
    departments: user.departments || [] as string[],
  });

  // Sync formData when user prop changes (e.g., after list refresh)
  useEffect(() => {
    setFormData({
      email: user.email || '',
      name: user.name || '',
      surname: user.surname || '',
      password: '',
      is_active: user.is_active,
      is_admin: user.is_admin,
      departments: user.departments || [],
    });
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only send changed fields
    const updateData: any = {};
    if (formData.email !== (user.email || '')) {
      updateData.email = formData.email || null;
    }
    if (formData.name !== (user.name || '')) {
      updateData.name = formData.name || null;
    }
    if (formData.surname !== (user.surname || '')) {
      updateData.surname = formData.surname || null;
    }
    if (formData.password) {
      updateData.password = formData.password;
    }
    if (formData.is_active !== user.is_active) {
      updateData.is_active = formData.is_active;
    }
    if (formData.is_admin !== user.is_admin) {
      updateData.is_admin = formData.is_admin;
    }
    // Compare departments - use spread to avoid mutating original arrays
    const userDepts = [...(user.departments || [])].sort();
    const formDepts = [...(formData.departments || [])].sort();
    if (JSON.stringify(userDepts) !== JSON.stringify(formDepts)) {
      updateData.departments = formData.departments;
    }

    onSubmit(updateData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDepartment = (dept: string) => {
    setFormData(prev => {
      const currentDepts = prev.departments || [];
      if (currentDepts.includes(dept)) {
        return { ...prev, departments: currentDepts.filter(d => d !== dept) };
      } else {
        return { ...prev, departments: [...currentDepts, dept] };
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Kullanıcı Düzenle
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <div className="h-2 w-2 bg-blue-500 rounded-full mr-2"></div>
                Temel Bilgiler
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ad
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Soyad
                  </label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => handleChange('surname', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Soyad"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yeni Şifre
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Değiştirmek için yeni şifre girin"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Boş bırakırsanız şifre değiştirilmez
                </p>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                Yetkiler
              </h4>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Aktif Kullanıcı
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_admin"
                    checked={formData.is_admin}
                    onChange={(e) => handleChange('is_admin', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_admin" className="ml-2 block text-sm text-gray-900">
                    Yönetici
                  </label>
                </div>
              </div>
            </div>

            {/* Departments */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <Building2 className="h-4 w-4 text-purple-500 mr-2" />
                Departmanlar
              </h4>
              <p className="text-xs text-gray-500">
                Kullanıcının erişebileceği döküman departmanlarını seçin. RAG sorguları bu departmanlara göre filtrelenir.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {DEPARTMENTS.map(dept => {
                  const isSelected = formData.departments?.includes(dept) || false;
                  return (
                    <label
                      key={dept}
                      className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDepartment(dept)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 rounded"
                      />
                      <span className="text-sm text-gray-700">{dept}</span>
                    </label>
                  );
                })}
              </div>

              {formData.is_admin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    ℹ️ Yönetici kullanıcılar tüm departmanlara erişebilir.
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              İptal
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Güncelleniyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Güncelle
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
