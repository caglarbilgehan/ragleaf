import { useState, useEffect } from 'react';
import { authApi } from '@/services/api';
import { useTranslation } from '@/contexts/LanguageContext';

interface UserInfo {
  id: number;
  email: string;
  name: string;
  surname: string;
  full_name: string;
}

export default function AccountPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<UserInfo | null>(null);
  
  // Profile Form States
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    const loadUserData = async () => {
      const savedUser = localStorage.getItem('ragleaf_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          setName(parsed.name || '');
          setSurname(parsed.surname || '');
          setEmail(parsed.email || '');
        } catch (e) {}
      }

      try {
        const freshUser = await authApi.getCurrentUser();
        setUser(freshUser as any);
        setName(freshUser.name || '');
        setSurname(freshUser.surname || '');
        setEmail(freshUser.email || '');
        localStorage.setItem('ragleaf_user', JSON.stringify(freshUser));
      } catch (err) {
        console.error('Failed to fetch fresh user info:', err);
      }
    };

    loadUserData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !surname.trim() || !email.trim()) {
      showNotification('error', t('account.err_fill_all'));
      return;
    }

    setProfileLoading(true);
    try {
      const updatedUser = await authApi.updateProfile({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
      });
      
      setUser(updatedUser as any);
      localStorage.setItem('ragleaf_user', JSON.stringify(updatedUser));
      showNotification('success', t('account.success_profile_update'));
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || t('account.err_profile_update'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('error', t('account.err_password_fill_all'));
      return;
    }
    if (newPassword.length < 8) {
      showNotification('error', t('account.err_password_len'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('error', t('account.err_password_mismatch'));
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.updateProfile({
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotification('success', t('account.success_password_update'));
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || t('account.err_password_update'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          ⚙️ {t('account.title')}
        </h1>
        <p className="text-gray-500 mt-1">{t('account.subtitle')}</p>
      </div>

      {notification && (
        <div className={`rounded-xl p-4 border transition-all ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <p className="font-medium text-sm">{notification.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details Card */}
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/[0.06] p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-5 flex items-center gap-2">
              👤 {t('account.profile_info')}
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.surname')}</label>
                <input
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full mt-2 px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {profileLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {t('account.loading_update')}
                  </>
                ) : (
                  t('account.btn_save_info')
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/[0.06] p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-5 flex items-center gap-2">
              🔑 {t('account.change_password')}
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.current_password')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.new_password')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('account.placeholder_password_len')}
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">{t('account.confirm_password')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('account.placeholder_password_len')}
                  className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full mt-2 px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {passwordLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {t('account.loading_update')}
                  </>
                ) : (
                  t('account.btn_update_password')
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
