# Requirements: Plan Fiyatlandırmaları ve Ürün Yetkilendirmeleri

## Amaç
Kullanıcı planlarının fiyatlarının ve özellik yetkilendirmelerinin güncellenmesi.

## Plan Fiyatları
- **Starter:** 50 USD
- **Pro:** 200 USD
- **Ultimate:** 350 USD
- **Ultra:** 600 USD

## Özellik/Ürün Yetkilendirmeleri
1. **AI Assistant (`has_ai_assistant`):** Tüm planlarda (Starter, Pro, Ultimate, Ultra) aktif.
2. **AIchat:** Tüm planlarda aktif (zaten asistan ile birlikte geliyor).
3. **AI Writer (`has_ai_writer`):** Sadece Ultimate ve Ultra planlarında aktif. Starter ve Pro planlarında pasif olacak.
4. **AI Automation (`has_ai_automation` veya benzeri yetki):** Sadece Ultra planında aktif olacak. Starter, Pro ve Ultimate planlarında pasif olacak.
