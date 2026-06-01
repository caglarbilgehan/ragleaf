import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/services/api';
import { getLogoUrl } from '@/utils/assets';
import type { User, LoginRequest } from '@/types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginRequest>();

  const testConnection = async () => {
    try {
      const result = await authApi.testConnection();
      toast.success('Backend bağlantısı başarılı!');
      console.log('Connection test result:', result);
    } catch (error) {
      toast.error('Backend bağlantısı başarısız!');
      console.error('Connection test failed:', error);
    }
  };

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      const user = response.user;

      // Allow admins, superadmins, and org members (tenants)
      if (!user.is_admin && !user.is_superadmin && !user.default_org_id) {
        setError('email', { 
          type: 'manual', 
          message: 'Bu hesap ile giriş yapılamıyor' 
        });
        return;
      }

      localStorage.setItem('ragleaf_token', response.access_token);
      localStorage.setItem('ragleaf_user', JSON.stringify(response.user));
      
      toast.success('Başarıyla giriş yapıldı!');
      onLogin(response.user);
      
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Giriş yapılırken bir hata oluştu';
      toast.error(message);
      
      if (message.includes('e-posta') || message.includes('şifre')) {
        setError('email', { type: 'manual', message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <span className="text-4xl mr-2">🍃</span>
            <h1 className="text-3xl font-bold text-gray-900">Ragleaf</h1>
          </div>
          <p className="text-gray-600 mt-2">Yönetim Paneli</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="label text-gray-700 mb-2 block">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email', { 
                    required: 'E-posta adresi gereklidir',
                    pattern: { value: /^\S+@\S+$/i, message: 'Geçerli bir e-posta adresi girin' }
                  })}
                  type="email"
                  className={`input pl-10 ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  placeholder="E-posta adresinizi girin"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email.message}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="label text-gray-700 mb-2 block">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password', { 
                    required: 'Şifre gereklidir',
                    minLength: { value: 4, message: 'En az 4 karakter olmalıdır' }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  placeholder="Şifrenizi girin"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center mt-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.password.message}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Giriş Yapılıyor...
                </div>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          {/* Test Connection Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={testConnection}
              className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Backend Bağlantısını Test Et
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          © 2026 Ragleaf · All rights reserved
        </div>
      </div>
    </div>
  );
}
