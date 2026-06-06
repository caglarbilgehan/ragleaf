"use client";

import React, { useState, useEffect } from 'react';
import { useLang } from '../../context/LangContext';
import PageLayout from '../../components/PageLayout';

export default function LegalClient() {
  const { lang } = useLang();
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const targetIds = lang === 'tr'
        ? ['gizlilik', 'kosullar', 'kvkk', 'mesafeli-satis', 'on-bilgilendirme', 'iptal-iade']
        : ['privacy', 'terms', 'kvkk-en', 'distance-sales', 'pre-info', 'refund'];
      
      let current = targetIds[0];
      for (const id of targetIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lang]);

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navLinkClass = (id) => {
    const base = "text-text-secondary no-underline text-xs font-semibold transition-all duration-200 py-1.5 block hover:text-accent";
    const active = activeSection === id ? "text-accent [text-shadow:0_0_8px_rgba(34,197,94,0.4)]" : "";
    return `${base} ${active}`;
  };

  return (
    <PageLayout>
      {lang === 'tr' ? (
        <>
          <div className="text-center px-5 pb-10 pt-0 max-w-[800px] mx-auto">
            <h1 className="font-['Outfit'] text-[48px] max-md:text-[32px] font-black tracking-tight mb-5 leading-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Yasal Bilgiler & Sözleşmeler</h1>
            <p className="text-lg text-text-secondary leading-relaxed">Ragleaf kullanım şartları, online ödeme güvenlik standartları, iptal/iade politikaları ve sözleşmelerimiz hakkında detaylı bilgilere buradan ulaşabilirsiniz.</p>
          </div>

          <div className="max-w-[1200px] mx-auto px-6 pb-20 max-md:pb-10 grid grid-cols-[280px_1fr] max-md:grid-cols-1 gap-16 max-md:gap-8">
            <div className="sticky top-[100px] h-fit max-md:hidden">
              <div className="flex flex-col gap-2 border-l border-border-custom pl-5">
                <a href="#gizlilik" onClick={(e) => handleNavClick(e, 'gizlilik')} className={navLinkClass('gizlilik')}>1. Gizlilik Politikası</a>
                <a href="#kosullar" onClick={(e) => handleNavClick(e, 'kosullar')} className={navLinkClass('kosullar')}>2. Kullanım Koşulları</a>
                <a href="#kvkk" onClick={(e) => handleNavClick(e, 'kvkk')} className={navLinkClass('kvkk')}>3. KVKK Aydınlatma Metni</a>
                <a href="#mesafeli-satis" onClick={(e) => handleNavClick(e, 'mesafeli-satis')} className={navLinkClass('mesafeli-satis')}>4. Mesafeli Satış Sözleşmesi</a>
                <a href="#on-bilgilendirme" onClick={(e) => handleNavClick(e, 'on-bilgilendirme')} className={navLinkClass('on-bilgilendirme')}>5. Ön Bilgilendirme Formu</a>
                <a href="#iptal-iade" onClick={(e) => handleNavClick(e, 'iptal-iade')} className={navLinkClass('iptal-iade')}>6. İptal ve İade Koşulları</a>
              </div>
            </div>

            <div className="text-text-secondary text-[15px] leading-[1.8] [&_section]:mb-16 [&_section]:bg-white/[0.01] [&_section]:border [&_section]:border-border-custom [&_section]:rounded-2xl [&_section]:p-10 max-md:[&_section]:p-6 [&_section]:backdrop-blur-md [&_section]:shadow-2xl [&_section]:scroll-mt-[100px] [&_h2]:font-['Outfit'] [&_h2]:text-[28px] max-md:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-0 [&_h2]:mb-6 [&_h2]:border-b [&_h2]:border-border-custom [&_h2]:pb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-7 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">
              {/* Section 1: Gizlilik Politikası */}
              <section id="gizlilik">
                <h2>1. Gizlilik Politikası</h2>
                <p><strong>Son Güncelleme:</strong> 4 Haziran 2026</p>
                <p>Ragleaf ("biz", "hizmetimiz"), kullanıcılarımızın gizliliğine son derece önem vermektedir. Bu Gizlilik Politikası, platformumuzu kullandığınızda verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklar.</p>
                
                <h3>1.1. Toplanan Veriler</h3>
                <p>Ragleaf platformunu kullanırken aşağıdaki veriler toplanabilir:</p>
                <ul>
                  <li><strong>Hesap Bilgileri:</strong> Kayıt olurken sağladığınız ad, e-posta adresi, telefon numarası ve işletme bilgileri.</li>
                  <li><strong>Yüklenen Dokümanlar:</strong> AI asistanınızı eğitmek amacıyla sisteme yüklediğiniz PDF, DOCX, TXT ve diğer formatlardaki belgeler.</li>
                  <li><strong>Konuşma Logları:</strong> AI asistanınız ile web sitenizin ziyaretçileri arasında gerçekleşen sohbet verileri ve oturum bilgileri.</li>
                  <li><strong>Ödeme Bilgileri:</strong> Abonelik ödemeleri sırasında kredi kartı bilgileriniz doğrudan PCI-DSS uyumlu lisanslı ödeme altyapısı sağlayıcımız (Stripe/PayTR) tarafından işlenir; kart bilgileriniz sunucularımızda saklanmaz.</li>
                </ul>

                <h3>1.2. Verilerin Kullanım Amacı</h3>
                <p>Toplanan kişisel veriler ve dokümanlar yalnızca aşağıdaki amaçlar doğrultusunda işlenmektedir:</p>
                <ul>
                  <li>Yapay zeka asistanınızın bilgi tabanını oluşturmak ve eğitmek.</li>
                  <li>Müşteri sorularına markanızla uyumlu, doğru yanıtlar üretmek.</li>
                  <li>Platform performansını izlemek, hataları ayıklamak ve kullanıcı deneyimini iyileştirmek.</li>
                  <li>Faturalama ve hesap yönetimi süreçlerini yönetmek.</li>
                </ul>

                <h3>1.3. Veri Güvenliği ve Şifreleme</h3>
                <p>Dokümanlarınız ve verileriniz endüstri standardı şifreleme yöntemleri (AES-256) kullanılarak saklanır. Verileriniz, rızanız olmadan üçüncü taraflarla paylaşılmaz veya yapay zeka modellerinin genel eğitimi için harici taraflara aktarılmaz.</p>
              </section>

              {/* Section 2: Kullanım Koşulları */}
              <section id="kosullar">
                <h2>2. Kullanım Koşulları</h2>
                <p>Ragleaf web sitesini ve bulut tabanlı yapay zeka asistan platformunu kullanarak, aşağıdaki kullanım koşullarını kabul etmiş bulunmaktasınız.</p>
                
                <h3>2.1. Hizmet Kullanımı ve Sorumluluklar</h3>
                <p>Ragleaf, kullanıcılarına kendi dokümanlarını yükleyerek özel yapay zeka temsilcileri oluşturma yetkisi verir. Platformu yasalara aykırı, yanıltıcı, telif haklarını ihlal eden veya zararlı içeriklerle eğitmek yasaktır. Yapay zeka asistanının ziyaretçilere verdiği yanıtlardan kaynaklanan doğrudan veya dolaylı ticari zararlardan satıcı sorumlu tutulamaz.</p>

                <h3>2.2. Sadakat Sistemi (Ragleaf Yaprağı)</h3>
                <p>Ragleaf platformu, kullanıcı etkileşimlerine dayalı bir ödüllendirme ("Yaprak Sadakat Sistemi") sunar. Biriken yapraklar nakde dönüştürülemez, yalnızca platform içi paket yenilemelerinde veya ek sorgu haklarında indirim olarak kullanılabilir.</p>

                <h3>2.3. Hesap Güvenliği</h3>
                <p>Hesap şifrenizin ve API anahtarlarınızın (API Keys) güvenliğinden tamamen siz sorumlusunuz. Yetkisiz erişim durumunda Ragleaf'i derhal bilgilendirmeniz gerekmektedir.</p>
              </section>

              {/* Section 3: KVKK Aydınlatma Metni */}
              <section id="kvkk">
                <h2>3. KVKK Aydınlatma Metni</h2>
                <p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla Ragleaf olarak kişisel verilerinizi kanuni sınırlar çerçevesinde işliyoruz.</p>
                
                <h3>3.1. Veri İşleme Amaçları ve Hukuki Sebepler</h3>
                <p>Kişisel verileriniz, kanunun 5. maddesinde belirtilen "sözleşmenin kurulması ve ifası" ile "veri sorumlusunun meşru menfaati" hukuki sebeplerine dayalı olarak elektronik ortamda otomatik yollarla işlenmektedir.</p>

                <h3>3.2. Veri Sahibi Hakları</h3>
                <p>KVKK'nın 11. maddesi kapsamında, kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme ve verilerin düzeltilmesini veya silinmesini isteme hakkına sahipsiniz. Taleplerinizi <a href="mailto:hello@ragleaf.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>hello@ragleaf.com</a> adresi üzerinden yazılı olarak iletebilirsiniz.</p>
              </section>

              {/* Section 4: Mesafeli Satış Sözleşmesi */}
              <section id="mesafeli-satis">
                <h2>4. Mesafeli Satış Sözleşmesi</h2>
                
                <h3>Madde 4.1. Taraflar</h3>
                <p>İşbu Sözleşme, aşağıdaki taraflar arasında elektronik ortamda onaylandığı tarihte kurulmuştur:</p>
                <table className="w-full border-collapse my-5 [&_th]:border [&_th]:border-border-custom [&_th]:p-3 [&_th]:text-left [&_td]:border [&_td]:border-border-custom [&_td]:p-3 [&_td]:text-left [&_th]:bg-white/[0.03] [&_th]:text-text-primary [&_th]:font-semibold [&_th]:w-[30%]">
                  <tbody>
                    <tr>
                      <th>SATICI (Sağlayıcı):</th>
                      <td>
                        <strong>Ragleaf Bilişim ve Yapay Zeka Teknolojileri A.Ş.</strong><br />
                        Adres: Maslak, Büyükdere Cd. No:243, 34485 Sarıyer/İstanbul<br />
                        Telefon: +90 212 999 8877<br />
                        E-posta: hello@ragleaf.com<br />
                        Mersis No: 0735099887700001<br />
                        Vergi Dairesi / No: Maslak V.D. / 7350998877
                      </td>
                    </tr>
                    <tr>
                      <th>ALICI (Müşteri):</th>
                      <td>Ragleaf platformuna üye olan ve ödeme yapan/hizmet alan gerçek veya tüzel kişi.</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Madde 4.2. Sözleşmenin Konusu</h3>
                <p>İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait www.ragleaf.com web sitesinden elektronik ortamda siparişini yaptığı, aşağıda nitelikleri ve satış fiyatı belirtilen bulut tabanlı yapay zeka asistanı abonelik hizmetinin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.</p>

                <h3>Madde 4.3. Hizmet ve Fiyatlandırma</h3>
                <p>Satın alınan SaaS hizmetinin türü, fiyatı, ödeme periyodu ve ödeme şekli sipariş esnasında ALICI tarafından seçilen abonelik paketine göre belirlenir. Yinelenen aboneliklerde ücret, her fatura döneminde ALICI'nın kayıtlı kartından otomatik tahsil edilir.</p>

                <h3>Madde 4.4. Genel Hükümler</h3>
                <ul>
                  <li>ALICI, hizmetin temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini kabul eder.</li>
                  <li>Sözleşme konusu SaaS hizmeti, ödemenin başarıyla tamamlanmasının ardından ALICI'nın üyelik paneline anında tanımlanarak ifa edilir.</li>
                  <li>SATICI, altyapı sağlayıcılarından (OpenAI, Anthropic vb.) kaynaklanan kesintilerden veya API erişim engellerinden sorumlu tutulamaz.</li>
                </ul>

                <h3>Madde 4.5. Cayma Hakkı</h3>
                <p>Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin ğ bendi uyarınca, "Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmeler" cayma hakkının istisnaları kapsamındadır. Bu nedenle, hizmet aktif edildikten sonra mevzuat gereği yasal cayma hakkı bulunmamaktadır. Ancak Ragleaf, müşteri memnuniyeti kapsamında satın alımdan itibaren 7 günlük özel bir iade hakkı tanımaktadır (Detaylar Madde 6'dadır).</p>

                <h3>Madde 4.6. Yetkili Mahkeme</h3>
                <p>Sözleşmenin uygulanmasında, Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri ile SATICI'nın yerleşim yerindeki (İstanbul Çağlayan) Tüketici Mahkemeleri yetkilidir.</p>
              </section>

              {/* Section 5: Ön Bilgilendirme Formu */}
              <section id="on-bilgilendirme">
                <h2>5. Ön Bilgilendirme Formu</h2>
                
                <h3>5.1. Satıcı Bilgileri</h3>
                <p><strong>Unvan:</strong> Ragleaf Bilişim ve Yapay Zeka Teknolojileri A.Ş.<br />
                <strong>Mersis:</strong> 0735099887700001<br />
                <strong>Adres:</strong> Maslak, Büyükdere Cd. No:243, 34485 Sarıyer/İstanbul<br />
                <strong>İletişim:</strong> hello@ragleaf.com / +90 212 999 8877</p>

                <h3>5.2. Sözleşme Konusu Hizmetin Nitelikleri</h3>
                <p>Ragleaf, kullanıcıların kendi yüklediği dökümanlara göre eğitilen bulut tabanlı bir yapay zeka asistan barındırma ve entegrasyon hizmetidir. Hizmet özellikleri, API limitleri ve sorgu adetleri satın alınan pakete göre değişiklik gösterir.</p>

                <h3>5.3. Total Fiyat ve Fatura</h3>
                <p>Seçilen pakete ait ücretlere KDV dahildir. Aylık veya yıllık yinelenen abonelik modeliyle çalışılmaktadır. Ödemeler kredi kartı vasıtasıyla online olarak tahsil edilir.</p>

                <h3>5.4. Cayma Hakkı İstisnası</h3>
                <p>Sözleşme konusu bulut hizmeti, dijital ortamda anında ifa edilmeye başlanan nitelikte bir hizmet olduğundan yasal 14 günlük cayma hakkı kapsamı dışındadır. ALICI ödemeyi onaylayarak bu durumu peşinen kabul etmiş sayılır.</p>
              </section>

              {/* Section 6: İptal ve İade Koşulları */}
              <section id="iptal-iade">
                <h2>6. İptal ve İade Koşulları</h2>
                
                <h3>6.1. Deneme Süresi</h3>
                <p>Ragleaf, yeni üye olan markalara 15 günlük ücretsiz deneme süresi tanır. Deneme süresi boyunca kredi kartından herhangi bir ücret tahsil edilmez. Deneme süresi bitmeden iptal edilen aboneliklerde hiçbir ücret yansıtılmaz.</p>

                <h3>6.2. Abonelik İptali</h3>
                <p>Kullanıcılar, üyelik panellerinden diledikleri an abonelik yenilemelerini durdurabilirler. İptal talebi yapıldığında mevcut paket süresi sonuna kadar hizmet kullanılmaya devam edilir, bir sonraki fatura döneminde karttan çekim yapılmaz.</p>

                <h3>6.3. Koşullu Ücret İadesi</h3>
                <p>Dijital hizmetlerde yasal cayma hakkı bulunmamasına rağmen, Ragleaf olarak müşterilerimize satın alım tarihinden itibaren **7 günlük koşullu iade hakkı** sunuyoruz. İade talebinin onaylanabilmesi için:</p>
                <ul>
                  <li>Paket satın alımından veya yenilenmesinden itibaren en fazla 7 gün geçmiş olmalıdır.</li>
                  <li>Kullanıcı hesabı üzerinde toplamda 10'dan fazla yapay zeka API araması/sorgusu gerçekleştirilmemiş olmalıdır.</li>
                  <li>Sisteme yüklenen dokümanların işlenmesi için yoğun sunucu kaynağı tüketilmemiş olmalıdır.</li>
                </ul>
                <p>Koşulları sağlayan iade talepleri hello@ragleaf.com adresine bildirildikten sonra 5-10 iş günü içerisinde ilgili kredi kartına iade edilir.</p>

                <h3>6.4. Sadakat Yapraklarının Durumu</h3>
                <p>Aboneliğin iptali veya iadesi durumunda, ilgili dönemde kazanılan Ragleaf Yaprağı (Sadakat Puanları) silinir. Birikmiş yaprakların nakit karşılığı iadesi kesinlikle talep edilemez.</p>
              </section>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="text-center px-5 pb-10 pt-0 max-w-[800px] mx-auto">
            <h1 className="font-['Outfit'] text-[48px] max-md:text-[32px] font-black tracking-tight mb-5 leading-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Legal Information & Agreements</h1>
            <p className="text-lg text-text-secondary leading-relaxed">You can access detailed information about Ragleaf's terms of use, online payment security standards, cancellation/refund policies, and our legal contracts here.</p>
          </div>

          <div className="max-w-[1200px] mx-auto px-6 pb-20 max-md:pb-10 grid grid-cols-[280px_1fr] max-md:grid-cols-1 gap-16 max-md:gap-8">
            <div className="sticky top-[100px] h-fit max-md:hidden">
              <div className="flex flex-col gap-2 border-l border-border-custom pl-5">
                <a href="#privacy" onClick={(e) => handleNavClick(e, 'privacy')} className={navLinkClass('privacy')}>1. Privacy Policy</a>
                <a href="#terms" onClick={(e) => handleNavClick(e, 'terms')} className={navLinkClass('terms')}>2. Terms of Use</a>
                <a href="#kvkk-en" onClick={(e) => handleNavClick(e, 'kvkk-en')} className={navLinkClass('kvkk-en')}>3. KVKK Disclosure Text</a>
                <a href="#distance-sales" onClick={(e) => handleNavClick(e, 'distance-sales')} className={navLinkClass('distance-sales')}>4. Distance Sales Agreement</a>
                <a href="#pre-info" onClick={(e) => handleNavClick(e, 'pre-info')} className={navLinkClass('pre-info')}>5. Pre-Information Form</a>
                <a href="#refund" onClick={(e) => handleNavClick(e, 'refund')} className={navLinkClass('refund')}>6. Cancellation & Refund Policy</a>
              </div>
            </div>

            <div className="text-text-secondary text-[15px] leading-[1.8] [&_section]:mb-16 [&_section]:bg-white/[0.01] [&_section]:border [&_section]:border-border-custom [&_section]:rounded-2xl [&_section]:p-10 max-md:[&_section]:p-6 [&_section]:backdrop-blur-md [&_section]:shadow-2xl [&_section]:scroll-mt-[100px] [&_h2]:font-['Outfit'] [&_h2]:text-[28px] max-md:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-0 [&_h2]:mb-6 [&_h2]:border-b [&_h2]:border-border-custom [&_h2]:pb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-7 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">
              {/* Section 1: Privacy Policy */}
              <section id="privacy">
                <h2>1. Privacy Policy</h2>
                <p><strong>Last Updated:</strong> June 4, 2026</p>
                <p>Ragleaf ("we", "our service") attaches great importance to the privacy of our users. This Privacy Policy explains how your data is collected, processed, and protected when you use our platform.</p>
                
                <h3>1.1. Collected Data</h3>
                <p>The following data may be collected when using the Ragleaf platform:</p>
                <ul>
                  <li><strong>Account Information:</strong> Name, email address, phone number, and business details you provide during registration.</li>
                  <li><strong>Uploaded Documents:</strong> PDF, DOCX, TXT, and other file formats uploaded to train your AI assistant.</li>
                  <li><strong>Conversation Logs:</strong> Chat messages and session details between your AI assistant and website visitors.</li>
                  <li><strong>Payment Details:</strong> Credit card details for subscriptions are processed directly by our PCI-DSS compliant licensed payment gateway providers (Stripe/PayTR); card details are never stored on our servers.</li>
                </ul>

                <h3>1.2. Purpose of Data Processing</h3>
                <p>Collected personal data and documents are processed solely for the following purposes:</p>
                <ul>
                  <li>To construct and train the knowledge base of your AI assistant.</li>
                  <li>To generate accurate, brand-aligned responses to customer inquiries.</li>
                  <li>To monitor platform performance, debug errors, and improve the overall user experience.</li>
                  <li>To manage billing, invoicing, and account lifecycles.</li>
                </ul>

                <h3>1.3. Data Security and Encryption</h3>
                <p>Your documents and data are encrypted at rest using industry-standard AES-256 encryption. Your data will never be shared with third parties or used for training public artificial intelligence models without your consent.</p>
              </section>

              {/* Section 2: Terms of Use */}
              <section id="terms">
                <h2>2. Terms of Use</h2>
                <p>By using the Ragleaf website and our cloud-based AI assistant platform, you agree to the following terms of use.</p>
                
                <h3>2.1. Service Usage and Liabilities</h3>
                <p>Ragleaf grants its users the ability to train custom AI agents by uploading their business documents. It is forbidden to train the assistant with illegal, misleading, copyright-infringing, or harmful content. The provider cannot be held liable for any direct or indirect commercial damages arising from responses generated by the AI assistant.</p>

                <h3>2.2. Loyalty System (Ragleaf Leaf)</h3>
                <p>The Ragleaf platform offers a loyalty and reward system based on interactions ("Leaf Loyalty System"). Accumulated leaves cannot be redeemed for cash; they can only be used as discounts for package renewals or additional query credits within the platform.</p>

                <h3>2.3. Account Security</h3>
                <p>You are fully responsible for the security of your account password and API keys. In the event of unauthorized access, you must notify Ragleaf immediately.</p>
              </section>

              {/* Section 3: KVKK Disclosure Text */}
              <section id="kvkk-en">
                <h2>3. KVKK Disclosure Text</h2>
                <p>In accordance with the Personal Data Protection Law No. 6698 ("KVKK"), as Ragleaf in the capacity of data controller, we process your personal data within legal boundaries.</p>
                
                <h3>3.1. Purpose of Processing and Legal Basis</h3>
                <p>Your personal data is processed electronically via automated means based on "contract establishment and execution" and "legitimate interest of the data controller" under Article 5 of the KVKK.</p>

                <h3>3.2. Rights of Data Subjects</h3>
                <p>Under Article 11 of the KVKK, you have the right to learn whether your personal data is being processed, request information, and demand correction or deletion of your data. You may submit your requests in writing to <a href="mailto:hello@ragleaf.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>hello@ragleaf.com</a>.</p>
              </section>

              {/* Section 4: Distance Sales Agreement */}
              <section id="distance-sales">
                <h2>4. Distance Sales Agreement</h2>
                
                <h3>Article 4.1. Parties</h3>
                <p>This Agreement has been established electronically on the date of approval between the following parties:</p>
                <table className="w-full border-collapse my-5 [&_th]:border [&_th]:border-border-custom [&_th]:p-3 [&_th]:text-left [&_td]:border [&_td]:border-border-custom [&_td]:p-3 [&_td]:text-left [&_th]:bg-white/[0.03] [&_th]:text-text-primary [&_th]:font-semibold [&_th]:w-[30%]">
                  <tbody>
                    <tr>
                      <th>SELLER (Provider):</th>
                      <td>
                        <strong>Ragleaf Bilişim ve Yapay Zeka Teknolojileri A.Ş.</strong><br />
                        Address: Maslak, Büyükdere Cd. No:243, 34485 Sarıyer/İstanbul<br />
                        Phone: +90 212 999 8877<br />
                        Email: hello@ragleaf.com<br />
                        Mersis No: 0735099887700001<br />
                        Tax Office / No: Maslak V.D. / 7350998877
                      </td>
                    </tr>
                    <tr>
                      <th>BUYER (Customer):</th>
                      <td>Any individual or legal entity subscribing to and receiving services from the Ragleaf platform.</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Article 4.2. Subject of Agreement</h3>
                <p>The subject of this Agreement is the sale and delivery of the cloud-based AI assistant subscription service purchased by the BUYER electronically on the www.ragleaf.com website, and the determination of the rights and obligations of the parties in accordance with the Law No. 6502 on the Protection of Consumers and the Distance Contracts Regulation.</p>

                <h3>Article 4.3. Service and Pricing</h3>
                <p>The type, price, billing cycle, and payment method of the purchased SaaS service are determined based on the subscription package selected by the BUYER. For recurring subscriptions, fees are automatically charged to the BUYER's registered card at the start of each billing period.</p>

                <h3>Article 4.4. General Provisions</h3>
                <ul>
                  <li>The BUYER acknowledges that they have read and understood the preliminary information regarding the characteristics, pricing, and payment of the service, and has confirmed it electronically.</li>
                  <li>The SaaS service is delivered immediately by activating the features on the BUYER's dashboard after successful payment.</li>
                  <li>The SELLER cannot be held responsible for service interruptions caused by third-party infrastructure providers (OpenAI, Anthropic, Gemini, etc.) or API blocks.</li>
                </ul>

                <h3>Article 4.5. Right of Withdrawal</h3>
                <p>According to Article 15(ğ) of the Distance Contracts Regulation, "contracts for services performed instantly in the electronic environment or intangible goods delivered instantly to the consumer" are excluded from the right of withdrawal. Therefore, once the service is activated, there is no legal right of withdrawal. However, Ragleaf offers a customer-satisfaction based 7-day conditional refund policy (details in Section 6).</p>

                <h3>Article 4.6. Jurisdiction</h3>
                <p>In the resolution of disputes arising from this agreement, the Consumer Arbitration Committees and the Consumer Courts in the place of the SELLER's residence (Istanbul Çağlayan) are authorized up to the value declared by the Ministry of Trade.</p>
              </section>

              {/* Section 5: Pre-Information Form */}
              <section id="pre-info">
                <h2>5. Pre-Information Form</h2>
                
                <h3>5.1. Seller Details</h3>
                <p><strong>Title:</strong> Ragleaf Bilişim ve Yapay Zeka Teknolojileri A.Ş.<br />
                <strong>Mersis:</strong> 0735099887700001<br />
                <strong>Address:</strong> Maslak, Büyükdere Cd. No:243, 34485 Sarıyer/İstanbul<br />
                <strong>Contact:</strong> hello@ragleaf.com / +90 212 999 8877</p>

                <h3>5.2. Characteristics of the Service</h3>
                <p>Ragleaf is a cloud-based AI assistant hosting and integration service trained on documents uploaded by the user. Service features, API limits, and query quotas vary based on the subscription package purchased.</p>

                <h3>5.3. Total Price and Billing</h3>
                <p>Prices for the selected packages include VAT. The platform operates on a monthly or annual recurring billing model. Payments are collected online via credit/debit card.</p>

                <h3>5.4. Exclusion of Withdrawal Right</h3>
                <p>Since this cloud service is executed instantly in the digital environment, it is excluded from the standard 14-day withdrawal right. The BUYER acknowledges this by confirming the payment.</p>
              </section>

              {/* Section 6: Cancellation & Refund Policy */}
              <section id="refund">
                <h2>6. Cancellation & Refund Policy</h2>
                
                <h3>6.1. Trial Period</h3>
                <p>Ragleaf provides a 15-day free trial period for new accounts. No charges are made to the credit card during the trial period. If cancelled before the trial ends, no fees will be charged.</p>

                <h3>6.2. Subscription Cancellation</h3>
                <p>Users can stop their subscription renewal at any time through their account dashboard. Once cancelled, the service remains active until the end of the current billing cycle, and no charges will be made for the next cycle.</p>

                <h3>6.3. Conditional Refunds</h3>
                <p>Although digital services are excluded from the standard right of withdrawal, Ragleaf offers a **7-day conditional refund policy** from the date of purchase. For a refund request to be approved:</p>
                <ul>
                  <li>The request must be made within 7 days of subscription activation or renewal.</li>
                  <li>The user account must have processed fewer than 10 total AI API queries/searches.</li>
                  <li>No heavy server resources must have been consumed for processing/indexing uploaded documents.</li>
                </ul>
                <p>Approved refunds are processed back to the original payment card within 5-10 business days after notifying hello@ragleaf.com.</p>

                <h3>6.4. Status of Loyalty Leaves</h3>
                <p>Upon cancellation or refund of a subscription, Ragleaf Leaves (loyalty points) earned during that billing period will be deleted. Accumulated leaves cannot be exchanged for cash.</p>
              </section>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
