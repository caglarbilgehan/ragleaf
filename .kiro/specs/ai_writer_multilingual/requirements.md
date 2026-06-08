# Requirements: AI Writer Çoklu Dil & Dil Varyasyonu Yapılandırması

## Amaç
AI Writer tarafından üretilen içeriklerin bağımsız iki farklı yazı olarak gösterilmesi yerine, aynı yazının farklı dillerdeki varyasyonları (Türkçe ve İngilizce) olarak gruplanması ve üretilirken tüm desteklenen dillerde eş zamanlı oluşturulması.

## Gereksinimler
1. **Eş Zamanlı Üretim (Manual & Otomasyon/Autonomous):**
   - Kullanıcı manuel bir makale ürettiğinde (`/writer/generate` API çağrısı), makale hem belirtilen dilde hem de otomatik olarak diğer hedef dilde (tr <=> en) eş zamanlı olarak üretilmeli ve her ikisi de veritabanına aynı `translation_group_id` ile kaydedilmelidir.
   - Arka plan otomasyon/scheduler akışı (`run_autonomous_generation` fonksiyonu) çalıştığında, makaleyi sadece tek dilde üretmek yerine eş zamanlı olarak diğer dildeki çevirisini de yapmalı ve ikisini aynı `translation_group_id` ile kaydetmelidir.
2. **Durum ve Zamanlama Senkronizasyonu:**
   - Bir makalenin durumu (`status`) değiştirildiğinde veya yayınlanma zamanı (`scheduled_at`) güncellendiğinde, aynı gruptaki (`translation_group_id`) diğer dildeki makaleler de bu durum/zamanlama değişiklikleriyle senkronize edilmelidir.
   - Makale yayınlama (`/writer/articles/{public_id}/publish` API çağrısı) yapıldığında, aynı gruptaki tüm dillerdeki makaleler yayına alınmalı (`status = "published"` ve `published_at = datetime.now()`).
