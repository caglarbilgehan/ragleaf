# 📋 Bekleyen Görevler (FUTURE-PLANS)

> Son güncelleme: 2026-06-03

---

## ✅ Tamamlanan Görevler

### GÖREV-1: Landing Page Buton Stilleri ✅
### GÖREV-2: Sektörel Hazır AI Asistan Şablonları ✅
- Kuaför, Diş Hekimi, E-Ticaret, Restoran şablonları
- Randevu sistemi (DB + API + AI chat entegrasyonu)
- Template Wizard + Appointments Dashboard
- Google Calendar OAuth2 + iCal feed
### GÖREV-3: Admin Paneli Refaktör ✅
### GÖREV-4: İlerleme Takip & Arşivleme Sistemi ✅
### GÖREV-5: AI/LLM Yapılandırma Ayarlarını Yönetim Paneline Taşıma ✅
- Global AI config endpoint'leri (backend)
- Admin "AI Yapılandırma" sayfası (LLM + RAG)
- Agent builder'dan Model & RAG sekmesi kaldırıldı
- Agent oluşturma global config'den besleniyor
### GÖREV-6: Varsayılan Panel → Müşteri Paneli ✅
### GÖREV-7: Landing Page Mobil Uyum + Widget Auto-Open ✅
- Hamburger menü CSS class-based toggle + responsive iyileştirmeler
- Widget autoOpen varsayılan true + agent builder toggle
### Hibrit RAG/LLM + Widget Markdown ✅
- LLM fallback yanıt sistemi (doküman yoksa bile yanıt)
- Widget markdown render desteği (tablo, bold, liste, code blocks)
- LLM Router bug fix (NULL handling, rollback prevention)
- Dockerfile 3-stage build optimizasyonu
### GÖREV-9: Console Hataları Düzeltme ✅
- 12 gereksiz sayfa kaldırılarak 500/404/401 hatalar çözüldü
### GÖREV-10: Admin Paneli Temizlik ✅
- Chunk/Enrichment/Test/Analytics sayfaları ve sidebar linkleri kaldırıldı

---

## 🔴 Yüksek Öncelik

### GÖREV-11: Agent Bazlı Döküman Yönetimi (Tenant + Şablon)
**Tarih:** 2026-06-03
**Açıklama:** Hazır şablonlar (kuaför vb.) için admin panelinden döküman yükleme. Tenant'lar kendi agentları için döküman yükleyebilmeli. Agent bazlı döküman işleme (embedding). Dökümanlar paylaşımlı veya izole kullanılabilmeli.
**Alt görevler:**
- [ ] Admin panelden şablon agentları için döküman yükleme UI
- [ ] Tenant panelden agent bazlı döküman yükleme UI
- [ ] Döküman → agent ilişkilendirme (çoklu-agent paylaşım)
- [ ] Döküman işleme pipeline (upload → chunk → embed)
- [ ] İzole vs paylaşımlı döküman modu

---

## 🟡 Orta Öncelik

### GÖREV-8: Randevu Hatırlatma Sistemi
**Tarih:** 2026-06-02
**Açıklama:** Randevu öncesi SMS veya email ile hatırlatma
**Alt görevler:**
- [ ] Email hatırlatma servisi (SMTP)
- [ ] SMS entegrasyonu (Twilio/NetGSM)
- [ ] Hatırlatma zamanlayıcı (30 dk, 1 saat, 1 gün öncesi)

### GÖREV-12: Tenant Döküman İzleme & Log Sistemi
**Tarih:** 2026-06-03
**Açıklama:** Tenantlar tarafından yüklenen dökümanlarda analiz, kalite kontrolü, sistem sağlığı izleme ve log tutma
**Alt görevler:**
- [ ] Döküman işleme durumu dashboard
- [ ] Kalite skoru ve hata raporlama
- [ ] İşleme logları görüntüleme
- [ ] Sistem sağlık izleme

---

## 🟢 Düşük Öncelik

*(Şu an yok)*

