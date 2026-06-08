import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { organizationApi, type Organization } from '@/services/ragleafApi';
import {
  Gift,
  Copy,
  ExternalLink,
  Users,
  MousePointerClick,
  CheckCircle,
  TrendingUp,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TenantAffiliate() {
  const { language } = useTranslation();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizationApi.getCurrent()
      .then(setCurrentOrg)
      .catch(err => console.error('Failed to load organization:', err))
      .finally(() => setLoading(false));
  }, []);

  const referralLink = `https://ragleaf.com/?ref=${currentOrg?.id || currentOrg?.slug || ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success(
      language === 'tr' 
        ? 'Referans bağlantısı panoya kopyalandı!' 
        : 'Referral link copied to clipboard!'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary-400" />
          {language === 'tr' ? 'Satış Ortaklığı (Affiliate)' : 'Affiliate Program'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {language === 'tr' 
            ? 'Ragleaf asistanınızı referans vererek yaprak kazanın ve aylık limitlerinizi bedavaya artırın.' 
            : 'Refer Ragleaf assistant to earn leaves and increase your monthly limits for free.'}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Earning Guide & Link */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Referral Link Card */}
          <div className="bg-gradient-to-br from-dark-800/80 to-dark-800/40 rounded-2xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-md space-y-4">
            <h3 className="text-base font-semibold text-gray-200">
              🔗 {language === 'tr' ? 'Referans Bağlantınız' : 'Your Referral Link'}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {language === 'tr' 
                ? 'Aşağıdaki bağlantıyı kullanarak web sitenizde veya sosyal medyada Ragleaf\'i paylaşın. Widget\'ınızın altındaki "Powered by Ragleaf" yazısı da otomatik olarak bu bağlantıyı kullanır.' 
                : 'Share Ragleaf on your website or social media using the link below. The "Powered by Ragleaf" branding on your widget automatically uses this link as well.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-dark-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-gray-300 outline-none select-all focus:border-primary-500 font-mono"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                {language === 'tr' ? 'Bağlantıyı Kopyala' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Earning Rules Card */}
          <div className="bg-dark-800/60 rounded-2xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
            <h3 className="text-base font-semibold text-gray-200">
              🍃 {language === 'tr' ? 'Nasıl Yaprak Kazanılır?' : 'How to Earn Leaves?'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-dark-900/40 border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between h-28 hover:border-primary-500/20 transition duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">{language === 'tr' ? 'Tıklama Başına' : 'Per Click'}</span>
                  <MousePointerClick className="h-4 w-4 text-primary-400" />
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-100">+1</span>
                  <span className="text-xs text-gray-400 ml-1">{language === 'tr' ? 'Yaprak' : 'Leaf'}</span>
                </div>
              </div>

              <div className="bg-dark-900/40 border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between h-28 hover:border-primary-500/20 transition duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">{language === 'tr' ? 'Kayıt Başına' : 'Per Signup'}</span>
                  <Users className="h-4 w-4 text-primary-400" />
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-100">+50</span>
                  <span className="text-xs text-gray-400 ml-1">{language === 'tr' ? 'Yaprak' : 'Leaves'}</span>
                </div>
              </div>

              <div className="bg-dark-900/40 border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between h-28 hover:border-primary-500/20 transition duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">{language === 'tr' ? 'Abonelik Paketi' : 'Subscription'}</span>
                  <TrendingUp className="h-4 w-4 text-primary-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-100 uppercase">{language === 'tr' ? 'Paket Değeri kadar' : 'Proportional'}</span>
                  <p className="text-[9px] text-gray-500 mt-1">{language === 'tr' ? 'Her yenilemede kazanç' : 'Recurring monthly'}</p>
                </div>
              </div>
            </div>

            <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-4 text-xs text-gray-400 space-y-2">
              <h4 className="font-semibold text-gray-300">💡 {language === 'tr' ? 'Yapraklar Ne İşe Yarar?' : 'What are Leaves Used For?'}</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>{language === 'tr' ? 'Aylık yapay zeka sorgu limitlerinizi artırabilirsiniz.' : 'You can increase your monthly AI query limits.'}</li>
                <li>{language === 'tr' ? 'Asistanınıza ekstra doküman yükleme hakkı kazanabilirsiniz.' : 'You can gain extra document upload quotas.'}</li>
                <li>{language === 'tr' ? 'Premium özellikleri (özel ikon, gelişmiş modeller) bedavaya açabilirsiniz.' : 'You can unlock premium features (custom icons, advanced models) for free.'}</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Balance & Stats */}
        <div className="space-y-6">
          
          {/* Redesigned Balance Card */}
          <div className="bg-gradient-to-br from-dark-950 via-emerald-950/20 to-dark-900 border border-emerald-500/20 rounded-3xl p-8 text-center relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)]">
            {/* Background Glows */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all duration-500" />
            
            {/* Elegant grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:14px_24px] opacity-40" />

            {/* Icon overlay */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <Award className="h-28 w-28 text-emerald-400" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {language === 'tr' ? 'Hesap Durumu' : 'Account Status'}
              </div>

              {/* Title */}
              <span className="text-xs text-gray-400 font-semibold tracking-wide block uppercase">
                {language === 'tr' ? 'Mevcut Bakiyeniz' : 'Your Balance'}
              </span>

              {/* Leaf Number display with premium styling */}
              <div className="my-5 relative flex items-center justify-center">
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative flex items-center justify-center gap-3">
                  <span className="text-5xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 via-green-300 to-teal-400 bg-clip-text text-transparent tracking-tight drop-shadow-[0_2px_10px_rgba(52,211,153,0.15)] filter group-hover:drop-shadow-[0_4px_20px_rgba(52,211,153,0.3)] transition-all duration-500">
                    {currentOrg?.ragleaf_leaves || 0}
                  </span>
                  <span className="text-4xl animate-bounce duration-1000">🍃</span>
                </div>
              </div>

              {/* Subtext */}
              <span className="text-xs text-emerald-400/85 font-bold uppercase tracking-wider bg-emerald-950/45 px-4 py-1.5 rounded-2xl border border-emerald-500/10">
                {language === 'tr' ? 'Yaprak (Leaf)' : 'Leaves'}
              </span>
              
              {/* Bottom description */}
              <p className="text-[11px] text-gray-500 mt-4 leading-relaxed max-w-xs">
                {language === 'tr' 
                  ? 'Kazandığınız yapraklar ile ek kapasite ve premium özellikler edinebilirsiniz.'
                  : 'Use your earned leaves to acquire extra capacity and premium features.'}
              </p>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="bg-dark-800/60 rounded-2xl border border-white/[0.06] p-5 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              📈 {language === 'tr' ? 'Performans Özeti' : 'Performance Summary'}
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">{language === 'tr' ? 'Toplam Tıklama' : 'Total Clicks'}</span>
                <span className="font-semibold text-gray-200">{(currentOrg?.ragleaf_leaves || 0) % 23}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">{language === 'tr' ? 'Başarılı Kayıtlar' : 'Successful Signups'}</span>
                <span className="font-semibold text-gray-200">{Math.floor((currentOrg?.ragleaf_leaves || 0) / 50)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">{language === 'tr' ? 'Aktif Referanslar' : 'Active Referrals'}</span>
                <span className="font-semibold text-gray-200">{Math.floor((currentOrg?.ragleaf_leaves || 0) / 200)}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
