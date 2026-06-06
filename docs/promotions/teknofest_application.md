# 🚀 TEKNOFEST Girişim 2026 Başvuru Dökümanı

## Proje Adı: Ragleaf Çoklu Kiracılı AI Asistan Platformu

### 1. Girişimin Özeti
Ragleaf, KOBİ'lerin ve içerik üreticilerinin kendi kurumsal verileriyle eğitilmiş yapay zeka asistanlarını kod yazmadan dakikalar içinde oluşturmalarını sağlayan yenilikçi bir SaaS platformudur. Geleneksel chatbotların aksine Ragleaf asistanları, sohbet akışı içinde randevu alabilir, masa rezervasyonu yapabilir ve Stripe/iypico gibi altyapılarla kredi kartı ödemesi tahsil edebilir.

### 2. Çözüm Üretilen Sorun / İhtiyaç
KOBİ'lerin dijital dönüşümündeki en büyük engeller teknik yetersizlik ve yüksek entegrasyon maliyetleridir. Müşteri sorularını yanıtlayan RAG sistemleri ile randevu/ödeme gibi operasyonel süreçleri yöneten transactional sistemler bugüne kadar hep ayrı geliştirilmiştir. Ragleaf, bu iki dünyayı hibrit bir asistan arayüzünde birleştirir.

### 3. Yenilikçi Yönü ve Teknolojik Derinliği
- **Hibrit Yapı**: Hem döküman analizi (RAG) yapabilen hem de yapılandırılmış JSON çıktılarıyla (APPOINTMENT_JSON, SPONSORSHIP_JSON vb.) sohbet içinde interaktif bileşenler (kartlar) render edebilen sistem.
- **pgvector Entegrasyonu**: PostgreSQL veritabanında saklanan vektör embedding'leri üzerinde hızlı anlamsal arama (semantic search) ve cross-document paylaşımı.
- **Ragleaf Leaves Sadakat Algoritması**: Kullanım yoğunluğuna ve token tüketimine göre kiracılara ödül puan dağıtan ve müşteri sadakatini artıran gamification katmanı.

### 4. Teknik Altyapı ve Mimarisi
- **Backend**: Python 3.10+ FastAPI framework, SQLAlchemy ORM, PostgreSQL (vektör veri tabanı dahil), Redis (önbellekleme ve rate limit).
- **Frontend / Landing**: Responsive glassmorphic Vanilla JS & CSS, Nginx clean URL routing.
- **Asistan Widget**: Shadow DOM izolasyonu ile WordPress, Shopify ve React projelerine çakışma yaşamadan entegre edilebilen gömülü widget.
