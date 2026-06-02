#!/usr/bin/env python3
"""
Seed script for Agent Templates.
Creates the initial set of sector-specific AI assistant templates.

Usage:
    python -m backend.scripts.seed_templates
"""

import sys
import os
import logging

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


TEMPLATES = [
    {
        "slug": "kuafor",
        "category": "beauty",
        "name": "Kuaför / Güzellik Salonu Asistanı",
        "description": "Kuaför ve güzellik salonları için randevu alma, hizmet bilgisi ve fiyat sorgulama asistanı.",
        "icon": "✂️",
        "is_featured": True,
        "sort_order": 1,
        "default_welcome_message": "Merhaba! 💇 {{firma_adi}} kuaför salonuna hoş geldiniz. Randevu almak, hizmetlerimiz hakkında bilgi almak veya fiyatlarımızı öğrenmek için bana yazabilirsiniz!",
        "default_system_prompt": """Sen {{firma_adi}} adlı kuaför/güzellik salonunun yapay zeka asistanısın.

## Görevlerin:
1. Müşterilere hizmetlerimiz hakkında bilgi ver
2. Randevu talebi al (tarih, saat, hizmet türü, isim, telefon)
3. Çalışma saatleri hakkında bilgilendir
4. Fiyat soruları için genel bilgi ver

## Hizmetlerimiz:
{{hizmetler_listesi}}

## Çalışma Saatleri:
{{calisma_saatleri_formatted}}

## İletişim:
📞 {{telefon}}
📍 {{adres}}

## Randevu Alma Kuralları:
- Randevu almak isteyen müşteriden şu bilgileri iste: İsim, Telefon, İstenen Tarih ve Saat, Hizmet Türü
- Tüm bilgileri aldıktan sonra randevuyu özetle ve onayla
- Çalışma saatleri dışında randevu kabul etme
- Aynı anda birden fazla hizmet istenebilir

## Davranış Kuralları:
- Her zaman nazik ve profesyonel ol
- Türkçe yanıt ver
- Rakip salonlar hakkında yorum yapma
- Tıbbi konularda (saç dökülmesi, cilt hastalığı vb.) doktora yönlendir
- Bilmediğin konularda "Bu konuda sizi salonumuzla iletişime geçmenizi öneririm" de
- Fiyat sorularında genel aralık ver, kesin fiyat için salona yönlendir""",
        "default_personality": {
            "tone": "friendly",
            "language": "tr",
            "response_style": "concise",
            "fallback_message": "Bu konuda bilgim yok. Detaylı bilgi için salonumuzu arayabilirsiniz: {{telefon}}"
        },
        "default_appearance": {
            "primary_color": "#ec4899",
            "text_color": "#FFFFFF",
            "position": "bottom-right",
            "width": 400,
            "height": 600,
            "show_branding": True,
            "bubble_icon": "chat",
            "border_radius": 16
        },
        "config_schema": [
            {
                "key": "firma_adi",
                "label": "Salon Adı",
                "type": "text",
                "required": True,
                "placeholder": "Örn: Elite Kuaför"
            },
            {
                "key": "hizmetler",
                "label": "Sunduğunuz Hizmetler",
                "type": "tag_list",
                "required": True,
                "placeholder": "Hizmet ekleyin...",
                "suggestions": [
                    "Saç Kesimi (Erkek)", "Saç Kesimi (Kadın)", "Saç Kesimi (Çocuk)",
                    "Saç Boyama", "Röfle", "Balyaj", "Ombre",
                    "Fön", "Maşa", "Topuz",
                    "Keratin Bakımı", "Saç Botoksu", "Protein Bakımı",
                    "Sakal Tıraşı", "Sakal Şekillendirme",
                    "Kaş Alımı", "Ağda",
                    "Gelin Saçı", "Makyaj",
                    "Cilt Bakımı", "El Bakımı", "Ayak Bakımı"
                ]
            },
            {
                "key": "calisma_saatleri",
                "label": "Çalışma Saatleri",
                "type": "schedule",
                "required": True,
                "default": {
                    "Pazartesi": "09:00 - 20:00",
                    "Salı": "09:00 - 20:00",
                    "Çarşamba": "09:00 - 20:00",
                    "Perşembe": "09:00 - 20:00",
                    "Cuma": "09:00 - 20:00",
                    "Cumartesi": "09:00 - 20:00",
                    "Pazar": "Kapalı"
                }
            },
            {
                "key": "telefon",
                "label": "Telefon Numarası",
                "type": "phone",
                "required": True,
                "placeholder": "+90 5XX XXX XX XX"
            },
            {
                "key": "adres",
                "label": "Salon Adresi",
                "type": "textarea",
                "required": False,
                "placeholder": "Mahalle, Cadde, No, İlçe/İl"
            }
        ],
        "preview_questions": [
            "Hangi hizmetleri sunuyorsunuz?",
            "Yarın saat 14:00'e randevu alabilir miyim?",
            "Saç boyama ne kadar sürer?",
            "Çalışma saatleriniz nedir?"
        ]
    },
    # =========================================================================
    # Diş Hekimi / Klinik Şablonu
    # =========================================================================
    {
        "slug": "dis-hekimi",
        "category": "health",
        "name": "Diş Hekimi / Klinik Asistanı",
        "description": "Diş klinikleri için randevu alma, tedavi bilgisi ve acil yönlendirme asistanı.",
        "icon": "🦷",
        "is_featured": True,
        "sort_order": 2,
        "default_welcome_message": "Merhaba! 🦷 {{firma_adi}} diş kliniğine hoş geldiniz. Randevu almak, tedavilerimiz hakkında bilgi almak veya acil durumlar için bana yazabilirsiniz!",
        "default_system_prompt": """Sen {{firma_adi}} adlı diş kliniğinin yapay zeka asistanısın.

## Görevlerin:
1. Hastalara tedavi hizmetlerimiz hakkında bilgi ver
2. Randevu talebi al (tarih, saat, tedavi türü, isim, telefon)
3. Çalışma saatleri hakkında bilgilendir
4. Acil durumlarda doğru yönlendirme yap

## Tedavilerimiz:
{{hizmetler_listesi}}

## Çalışma Saatleri:
{{calisma_saatleri_formatted}}

## İletişim:
📞 {{telefon}}
📍 {{adres}}

## Randevu Alma Kuralları:
- Randevu almak isteyen hastadan şu bilgileri iste: İsim, Telefon, İstenen Tarih ve Saat, Tedavi/Şikayet Türü
- Tüm bilgileri aldıktan sonra randevuyu özetle ve onayla
- Çalışma saatleri dışında randevu kabul etme
- Acil durumlarda (şiddetli ağrı, kanama, travma) en yakın acil servise yönlendir

## Davranış Kuralları:
- Her zaman nazik, güven veren ve profesyonel ol
- Türkçe yanıt ver
- Teşhis koyma, sadece genel bilgi ver
- İlaç önerisi yapma
- "Bu konuda doktorumuz sizi muayene ettikten sonra en doğru bilgiyi verecektir" formülünü kullan
- Diş sağlığı ipuçları paylaşabilirsin (fırçalama tekniği, diş ipi kullanımı vb.)
- Fiyat sorularında genel aralık ver, kesin fiyat için kliniğe yönlendir""",
        "default_personality": {
            "tone": "professional",
            "language": "tr",
            "response_style": "balanced",
            "fallback_message": "Bu konuda bilgim yok. Detaylı bilgi için kliniğimizi arayabilirsiniz: {{telefon}}"
        },
        "default_appearance": {
            "primary_color": "#0ea5e9",
            "text_color": "#FFFFFF",
            "position": "bottom-right",
            "width": 400,
            "height": 600,
            "show_branding": True,
            "bubble_icon": "chat",
            "border_radius": 16
        },
        "config_schema": [
            {
                "key": "firma_adi",
                "label": "Klinik Adı",
                "type": "text",
                "required": True,
                "placeholder": "Örn: Gülümseme Diş Kliniği"
            },
            {
                "key": "hizmetler",
                "label": "Tedavi Hizmetleri",
                "type": "tag_list",
                "required": True,
                "placeholder": "Tedavi ekleyin...",
                "suggestions": [
                    "Diş Dolgusu", "Kanal Tedavisi", "Diş Çekimi",
                    "Diş Taşı Temizliği", "Diş Beyazlatma",
                    "İmplant", "Zirkonyum Kaplama", "Lamine Veneer",
                    "Ortodonti (Tel Tedavisi)", "Şeffaf Plak (Invisalign)",
                    "Çocuk Diş Hekimliği", "Diş Eti Tedavisi",
                    "Gülüş Tasarımı", "Protez (Tam/Yarım)",
                    "Panoramik Röntgen", "Tomografi",
                    "Ağız İçi Muayene", "Flor Uygulaması",
                    "Gece Plağı", "Ağız Cerrahisi"
                ]
            },
            {
                "key": "calisma_saatleri",
                "label": "Çalışma Saatleri",
                "type": "schedule",
                "required": True,
                "default": {
                    "Pazartesi": "09:00 - 18:00",
                    "Salı": "09:00 - 18:00",
                    "Çarşamba": "09:00 - 18:00",
                    "Perşembe": "09:00 - 18:00",
                    "Cuma": "09:00 - 18:00",
                    "Cumartesi": "10:00 - 15:00",
                    "Pazar": "Kapalı"
                }
            },
            {
                "key": "telefon",
                "label": "Telefon Numarası",
                "type": "phone",
                "required": True,
                "placeholder": "+90 5XX XXX XX XX"
            },
            {
                "key": "adres",
                "label": "Klinik Adresi",
                "type": "textarea",
                "required": False,
                "placeholder": "Mahalle, Cadde, No, İlçe/İl"
            },
            {
                "key": "doktor_adi",
                "label": "Hekim Adı",
                "type": "text",
                "required": False,
                "placeholder": "Dt. Ahmet Yılmaz"
            }
        ],
        "preview_questions": [
            "Hangi tedavileri uyguluyorsunuz?",
            "Yarın öğleden sonra randevu alabilir miyim?",
            "İmplant tedavisi ne kadar sürer?",
            "Diş beyazlatma fiyatları nedir?"
        ]
    },
    # =========================================================================
    # E-Ticaret / Online Mağaza Şablonu
    # =========================================================================
    {
        "slug": "e-ticaret",
        "category": "retail",
        "name": "E-Ticaret / Online Mağaza Asistanı",
        "description": "Online mağazalar için sipariş takip, ürün bilgisi, iade/değişim ve müşteri destek asistanı.",
        "icon": "🛒",
        "is_featured": True,
        "sort_order": 3,
        "default_welcome_message": "Merhaba! 🛍️ {{firma_adi}} mağazasına hoş geldiniz. Sipariş takibi, ürün bilgisi, iade/değişim veya herhangi bir konuda size yardımcı olabilirim!",
        "default_system_prompt": """Sen {{firma_adi}} adlı online mağazanın müşteri destek asistanısın.

## Görevlerin:
1. Sipariş durumu hakkında bilgi ver
2. Ürünler ve kategoriler hakkında bilgilendir
3. İade/değişim süreçlerini açıkla
4. Kargo ve teslimat bilgisi ver
5. Kampanya ve indirimler hakkında bilgi ver

## Ürün Kategorileri:
{{kategoriler_listesi}}

## Kargo & Teslimat:
{{kargo_bilgisi}}

## İade/Değişim Politikası:
{{iade_politikasi}}

## İletişim:
📞 {{telefon}}
📧 {{email}}
🌐 {{website}}

## Davranış Kuralları:
- Her zaman samimi ve yardımsever ol
- Türkçe yanıt ver
- Sipariş numarası ile sorgulama yapılamaz (güvenlik), müşteriyi web sitesine yönlendir
- Stok bilgisi için web sitesini kontrol etmesini öner
- Şikayet durumunda anlayışlı ol ve çözüm odaklı yaklaş
- Rakip firmalar hakkında yorum yapma
- Bilmediğin konularda müşteri hizmetleri hattına yönlendir""",
        "default_personality": {
            "tone": "friendly",
            "language": "tr",
            "response_style": "balanced",
            "fallback_message": "Bu konuda bilgim yok. Müşteri hizmetlerimizi {{telefon}} numarasından arayabilirsiniz."
        },
        "default_appearance": {
            "primary_color": "#8b5cf6",
            "text_color": "#FFFFFF",
            "position": "bottom-right",
            "width": 400,
            "height": 600,
            "show_branding": True,
            "bubble_icon": "chat",
            "border_radius": 16
        },
        "config_schema": [
            {
                "key": "firma_adi",
                "label": "Mağaza Adı",
                "type": "text",
                "required": True,
                "placeholder": "Örn: ModaShop"
            },
            {
                "key": "kategoriler",
                "label": "Ürün Kategorileri",
                "type": "tag_list",
                "required": True,
                "placeholder": "Kategori ekleyin...",
                "suggestions": [
                    "Kadın Giyim", "Erkek Giyim", "Çocuk Giyim",
                    "Ayakkabı", "Çanta & Aksesuar",
                    "Elektronik", "Telefon & Tablet",
                    "Ev & Yaşam", "Mobilya",
                    "Kozmetik", "Parfüm",
                    "Spor & Outdoor", "Kitap",
                    "Gıda", "İçecek",
                    "Oyuncak", "Pet Ürünleri"
                ]
            },
            {
                "key": "kargo_bilgisi",
                "label": "Kargo & Teslimat Bilgisi",
                "type": "textarea",
                "required": True,
                "placeholder": "Örn: 150 TL üzeri ücretsiz kargo. 2-4 iş günü teslimat. Aynı gün kargo..."
            },
            {
                "key": "iade_politikasi",
                "label": "İade/Değişim Politikası",
                "type": "textarea",
                "required": True,
                "placeholder": "Örn: 14 gün içinde koşulsuz iade. Ürün kullanılmamış olmalı..."
            },
            {
                "key": "telefon",
                "label": "Müşteri Hizmetleri Telefonu",
                "type": "phone",
                "required": True,
                "placeholder": "0850 XXX XX XX"
            },
            {
                "key": "email",
                "label": "Destek E-posta",
                "type": "text",
                "required": False,
                "placeholder": "destek@firmaadi.com"
            },
            {
                "key": "website",
                "label": "Web Sitesi",
                "type": "text",
                "required": False,
                "placeholder": "https://www.firmaadi.com"
            }
        ],
        "preview_questions": [
            "Siparişim ne zaman gelir?",
            "İade etmek istiyorum, nasıl yapabilirim?",
            "Ücretsiz kargo var mı?",
            "İndirimli ürünler hangileri?"
        ]
    },
    # =========================================================================
    # Restoran / Kafe Şablonu
    # =========================================================================
    {
        "slug": "restoran",
        "category": "food",
        "name": "Restoran / Kafe Asistanı",
        "description": "Restoranlar ve kafeler için menü bilgisi, rezervasyon ve sipariş asistanı.",
        "icon": "🍽️",
        "is_featured": False,
        "sort_order": 4,
        "default_welcome_message": "Merhaba! 🍽️ {{firma_adi}} restoranına hoş geldiniz. Menümüz, rezervasyon veya herhangi bir konuda size yardımcı olabilirim!",
        "default_system_prompt": """Sen {{firma_adi}} adlı restoranın/kafenin yapay zeka asistanısın.

## Görevlerin:
1. Menü hakkında bilgi ver
2. Rezervasyon talebi al (tarih, saat, kişi sayısı, isim, telefon)
3. Çalışma saatleri hakkında bilgilendir
4. Alerjik veya diyet bilgisi sor

## Menümüz:
{{menu_kategorileri_listesi}}

## Çalışma Saatleri:
{{calisma_saatleri_formatted}}

## İletişim:
📞 {{telefon}}
📍 {{adres}}

## Öne Çıkan:
{{one_cikan_bilgi}}

## Rezervasyon Alma Kuralları:
- Rezervasyon almak isteyen müşteriden şu bilgileri iste: İsim, Telefon, İstenen Tarih ve Saat, Kişi Sayısı
- Özel istek varsa (doğum günü pastası, alerjiler) not al
- Tüm bilgileri aldıktan sonra rezervasyonu özetle ve onayla

## Davranış Kuralları:
- Her zaman samimi, sıcak ve davetkar ol
- Türkçe yanıt ver
- Yemekleri iştah açıcı şekilde tanımla
- Alerjen bilgisi sorulursa dikkatli ol, kesin bilgi için restorandan teyit öner
- Fiyat sorularında genel bilgi ver""",
        "default_personality": {
            "tone": "friendly",
            "language": "tr",
            "response_style": "balanced",
            "fallback_message": "Bu konuda bilgim yok. Detaylı bilgi için bizi arayabilirsiniz: {{telefon}}"
        },
        "default_appearance": {
            "primary_color": "#f97316",
            "text_color": "#FFFFFF",
            "position": "bottom-right",
            "width": 400,
            "height": 600,
            "show_branding": True,
            "bubble_icon": "chat",
            "border_radius": 16
        },
        "config_schema": [
            {
                "key": "firma_adi",
                "label": "Restoran / Kafe Adı",
                "type": "text",
                "required": True,
                "placeholder": "Örn: Lezzet Durağı"
            },
            {
                "key": "menu_kategorileri",
                "label": "Menü Kategorileri",
                "type": "tag_list",
                "required": True,
                "placeholder": "Kategori ekleyin...",
                "suggestions": [
                    "Kahvaltı", "Çorbalar", "Salatalar",
                    "Başlangıçlar (Meze)", "Ana Yemekler",
                    "Izgara & Kebap", "Makarna & Pizza",
                    "Burger & Sandviç", "Deniz Ürünleri",
                    "Tatlılar", "İçecekler",
                    "Kahve & Çay", "Kokteyl & Bar",
                    "Vegan / Vejetaryen", "Çocuk Menüsü"
                ]
            },
            {
                "key": "calisma_saatleri",
                "label": "Çalışma Saatleri",
                "type": "schedule",
                "required": True,
                "default": {
                    "Pazartesi": "11:00 - 23:00",
                    "Salı": "11:00 - 23:00",
                    "Çarşamba": "11:00 - 23:00",
                    "Perşembe": "11:00 - 23:00",
                    "Cuma": "11:00 - 00:00",
                    "Cumartesi": "10:00 - 00:00",
                    "Pazar": "10:00 - 22:00"
                }
            },
            {
                "key": "one_cikan_bilgi",
                "label": "Öne Çıkan Bilgi",
                "type": "textarea",
                "required": False,
                "placeholder": "Örn: Canlı müzik Cuma-Cumartesi. Bahçemiz mevcuttur. Paket servis yapılmaktadır."
            },
            {
                "key": "telefon",
                "label": "Telefon Numarası",
                "type": "phone",
                "required": True,
                "placeholder": "+90 5XX XXX XX XX"
            },
            {
                "key": "adres",
                "label": "Adres",
                "type": "textarea",
                "required": False,
                "placeholder": "Mahalle, Cadde, No, İlçe/İl"
            }
        ],
        "preview_questions": [
            "Bugün menüde ne var?",
            "Bu akşam 4 kişilik rezervasyon yapabilir miyim?",
            "Vegan seçenekleriniz var mı?",
            "Paket servis yapıyor musunuz?"
        ]
    }
]


def seed_templates():
    """Insert or update agent templates in the database."""
    from backend.database.connection_v2 import SessionLocal
    from backend.database.models_platform import AgentTemplate
    
    db = SessionLocal()
    
    try:
        created = 0
        updated = 0
        
        for tmpl_data in TEMPLATES:
            existing = db.query(AgentTemplate).filter(
                AgentTemplate.slug == tmpl_data["slug"]
            ).first()
            
            if existing:
                # Update existing template
                for key, value in tmpl_data.items():
                    if key != "slug":
                        setattr(existing, key, value)
                updated += 1
                logger.info(f"🔄 Updated template: {tmpl_data['slug']}")
            else:
                # Create new template
                template = AgentTemplate(**tmpl_data)
                db.add(template)
                created += 1
                logger.info(f"✅ Created template: {tmpl_data['slug']}")
        
        db.commit()
        logger.info(f"\n📊 Seed complete: {created} created, {updated} updated")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_templates()
