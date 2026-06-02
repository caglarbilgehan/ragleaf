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
