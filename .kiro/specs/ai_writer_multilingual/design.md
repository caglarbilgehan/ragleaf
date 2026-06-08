# Design: AI Writer Çoklu Dil & Dil Varyasyonu Yapılandırması

## Veritabanı Modeli ve İlişki Yapısı
- `writer_articles` tablosundaki `translation_group_id` alanı, aynı makalenin Türkçe ve İngilizce varyasyonlarını birbirine bağlamak için kullanılır.
- Her iki makale de kendi dil kodu (`language="tr"` ve `language="en"`) ile kaydedilir.

## API Değişiklikleri (`backend/api/writer.py`)
1. **`generate_article` Endpostu:**
   - Manuel üretim sırasında `group_id` (UUID) oluşturulur.
   - Birincil dil makalesi veritabanına eklenir.
   - `translate_article_content` çağrılarak diğer dile çevrilen makale oluşturulur ve aynı `translation_group_id` ile kaydedilir.
2. **`update_article` Endpostu:**
   - Güncelleme sırasında paylaşılan alanlar (`status`, `scheduled_at`, `mode`, `publishing_platform`, `agent_id`) gruptaki diğer makalelere de yansıtılır.
3. **`publish_article` Endpostu:**
   - Makale yayınlandığında, o gruba ait (`translation_group_id`) diğer dildeki makaleler de `published` durumuna getirilir.

## Scheduler Değişiklikleri (`backend/services/writer_scheduler.py`)
1. **`run_autonomous_generation` Fonksiyonu:**
   - Otomatik makale üretimi sırasında da `translation_group_id` oluşturulmalı.
   - Birincil makale eklendikten sonra `translate_article_content` fonksiyonu çağrılarak hedef dildeki çeviri oluşturulmalı ve veritabanına kaydedilmelidir.
