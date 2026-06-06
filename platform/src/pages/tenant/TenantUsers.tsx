import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, UserCheck, AlertCircle, X } from 'lucide-react';

interface OrgUser {
  id: number;
  email: string;
  name: string | null;
  surname: string | null;
  full_name: string | null;
  is_active: boolean;
  role: string;
  joined_at: string | null;
}

export default function TenantUsers() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', surname: '', password: '', role: 'member' });
  const [creating, setCreating] = useState(false);

  const token = localStorage.getItem('ragleaf_token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const API_BASE = window.location.hostname.includes('ragleaf.com')
    ? 'https://api.ragleaf.com'
    : 'http://localhost:1306';

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/org/users`, { headers });
      if (!res.ok) throw new Error('Kullanıcılar yüklenemedi');
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/org/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Kullanıcı oluşturulamadı');
      }
      setShowModal(false);
      setForm({ email: '', name: '', surname: '', password: '', role: 'member' });
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('Bu kullanıcıyı organizasyondan çıkarmak istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/org/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Kullanıcı çıkarılamadı');
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/org/users/${userId}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Rol değiştirilemedi');
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    admin: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    member: 'bg-dark-600 text-gray-200 border border-white/[0.06]'
  };

  const roleLabels: Record<string, string> = {
    owner: 'Sahip',
    admin: 'Yönetici',
    member: 'Üye'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Users className="h-7 w-7 text-primary-400" />
            Kullanıcılar
          </h1>
          <p className="text-gray-500 mt-1">Organizasyonunuzdaki kullanıcıları yönetin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Kullanıcı Ekle
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-red-400 hover:text-red-300" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-dark-800/60 shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-white/[0.04]">
          <thead className="bg-dark-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-posta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-dark-800/60 divide-y divide-white/[0.04]">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Henüz kullanıcı yok. "Kullanıcı Ekle" butonuyla başlayın.
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="hover:bg-dark-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-primary-400">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-100">
                        {user.full_name || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${roleColors[user.role] || 'bg-dark-600'}`}
                    >
                      <option value="member">Üye</option>
                      <option value="admin">Yönetici</option>
                      <option value="owner">Sahip</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      user.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      <UserCheck className="h-3 w-3" />
                      {user.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleRemove(user.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Kullanıcıyı çıkar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800/60 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-100">Yeni Kullanıcı Ekle</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-300" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">E-posta *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="input w-full"
                  placeholder="kullanici@sirket.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">İsim</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="input w-full"
                    placeholder="Ali"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Soyisim</label>
                  <input
                    type="text"
                    value={form.surname}
                    onChange={e => setForm({...form, surname: e.target.value})}
                    className="input w-full"
                    placeholder="Yılmaz"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Şifre *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="input w-full"
                  placeholder="En az 6 karakter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}
                  className="input w-full"
                >
                  <option value="member">Üye — Görüntüleme ve kullanım</option>
                  <option value="admin">Yönetici — Kullanıcı ve asistan yönetimi</option>
                  <option value="owner">Sahip — Tam yetki</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-300 bg-dark-600 rounded-lg hover:bg-dark-500 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.email || !form.password || creating}
                className="btn btn-primary"
              >
                {creating ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
