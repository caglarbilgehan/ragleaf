# Spec: Document Monitoring Requirements (GÖREV-12)

## Overview
The document monitoring system allows tenants to trace the extraction, OCR, indexing, and embedding stages of documents loaded into their knowledge base. It calculates a dynamic "Quality Score" based on document structural features and provides a visual logs timeline and system services health status.

## Requirements

1. **Document Details Endpoint**:
   - A GET route `/api/agents/{agent_id}/documents/{document_id}/details` must return:
     - Document metadata (original filename, size, type, status, chunk counts, etc.).
     - Heuristic Quality Score (0-100) and structured list of issues/warnings/suggestions.
     - Parse and return the document's `processing_logs` as a formatted JSON array for timeline visualization.
     - Global system services health statuses (database, OCR/tesseract, embedding).

2. **Quality Heuristics Algorithm (0-100)**:
   - Start with a base score of 100.
   - If document status is `error`: Score is 0.
   - Deductions:
     - **Empty Document**: If `status == "processed"` and `total_chunks == 0` (or `None`), deduct 40 points. (Suggestion: "Dokümanda metin bulunamadı veya boş. Lütfen taranmış PDF ise OCR aktif şekilde tekrar yükleyin.")
     - **Unprocessed PDF OCR**: If `file_type.lower() == "pdf"` and `file_size > 2000000` (approx 2MB) and `ocr_completed` is `False`, deduct 15 points. (Suggestion: "Büyük PDF dokümanlarında OCR kullanılmaması bazı metinlerin atlanmasına yol açabilir.")
     - **Low Chunk Density**: If `file_size > 500000` (500KB) and `total_chunks < 3`, deduct 20 points. (Suggestion: "Dosya boyutuna kıyasla elde edilen parça (chunk) sayısı çok düşük. Parçalama ayarlarını kontrol edin.")
     - **High Chunk Density**: If `file_size < 10000` (10KB) and `total_chunks > 50`, deduct 20 points. (Suggestion: "Küçük dosya boyutuna kıyasla çok fazla parça oluşturulmuş, bu durum gereksiz bölünmelere yol açabilir.")
     - **Stuck Processing**: If `status == "processing"` and more than 15 minutes have passed since `updated_at` (or `created_at`), deduct 30 points. (Suggestion: "İşleme süresi normalden uzun sürüyor. Sistem yükünü veya işlem durumunu kontrol edin.")
   - Min Score: 0, Max Score: 100.
   - Quality Tier Mapping:
     - 85-100: Excellent (Mükemmel)
     - 60-84: Good (İyi)
     - 30-59: Moderate (Orta)
     - 0-29: Low (Düşük)

3. **Log Processing**:
   - `processing_logs` stored in the database as a JSON string or JSONB array must be parsed.
   - If it's a JSON string, deserialize safely to a list of dicts.
   - If no logs exist, fall back to a synthesized stage list based on the document's current state and progress.

4. **System Health Statuses**:
   - **Database**: Run a quick connectivity check (`SELECT 1`).
   - **OCR (Tesseract)**: Verify if `pytesseract` is loaded and can retrieve its version.
   - **Embedding**: Check if unified embedding service can fetch active default model metadata or run check.

5. **Frontend Details Dialog**:
   - A beautiful modal in the dashboard allowing the user to view:
     - Quality gauge (circular progress/arc) with colored tier rating.
     - Specific structural recommendations.
     - Interactive vertical timeline showing stages (e.g., text_extraction, chunking, embedding, indexing) with timestamps, levels, and messages.
     - System services health badges (Database, OCR, Embedding).
