import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/services/api';
import { getLogoUrl } from '@/utils/assets';
import type { User, LoginRequest } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginRequest>();

  const testConnection = async () => {
    try {
      const result = await authApi.testConnection();
      toast.success(t('login.toast_conn_success'));
      console.log('Connection test result:', result);
    } catch (error) {
      toast.error(t('login.toast_conn_error'));
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
          message: t('login.err_cannot_login') 
        });
        return;
      }

      localStorage.setItem('ragleaf_token', response.access_token);
      localStorage.setItem('ragleaf_user', JSON.stringify(response.user));
      
      toast.success(t('login.toast_login_success'));
      onLogin(response.user);
      
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || t('login.err_unknown');
      toast.error(message);
      
      if (message.includes('e-posta') || message.includes('şifre')) {
        setError('email', { type: 'manual', message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/[0.04] blur-[120px] pointer-events-none" />
      
      <div className="max-w-md w-full relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src={getLogoUrl('dark')} alt="Ragleaf" className="h-10 w-10 mr-2.5" />
            <h1 className="text-3xl font-bold text-gray-100">Ragleaf</h1>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-dark-800/60 backdrop-blur-md rounded-2xl border border-white/[0.06] shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="label mb-2 block">
                {t('login.email_label')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  {...register('email', { 
                    required: t('login.email_required'),
                    pattern: { value: /^\S+@\S+$/i, message: t('login.email_invalid') }
                  })}
                  type="email"
                  className={`input pl-10 ${errors.email ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                  placeholder={t('login.email_placeholder')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <div className="flex items-center mt-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email.message}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="label mb-2 block">
                {t('login.password_label')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  {...register('password', { 
                    required: t('login.password_required'),
                    minLength: { value: 4, message: t('login.password_min_length') }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                  placeholder={t('login.password_placeholder')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                  )}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center mt-2 text-red-400 text-sm">
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
                  {t('login.btn_logging_in')}
                </div>
              ) : (
                t('login.btn_login')
              )}
            </button>
          </form>

          {/* Test Connection Button */}
          {import.meta.env.DEV && (
            <div className="mt-4">
              <button
                type="button"
                onClick={testConnection}
                className="w-full px-4 py-2 text-sm bg-dark-700 hover:bg-dark-600 text-gray-400 rounded-lg transition-colors border border-white/[0.06]"
              >
                {t('login.btn_test_conn')}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          © 2026 Ragleaf · All rights reserved
        </div>
      </div>
    </div>
  );
}
