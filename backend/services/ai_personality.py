"""
AI Personality and System Prompts for Ragleaf Platform
Per-tenant customization: Each agent/tenant defines their own system prompt via the Agent model.
This module provides generic fallback prompts when no tenant-specific prompt is configured.
"""

RAGLEAF_DEFAULT_SYSTEM_PROMPT = """Sen bir yapay zeka asistanısın.

KİMLİĞİN VE GÖREVIN:
- Kullanıcılara yardımcı olan profesyonel bir AI asistanısın
- Sorulara detaylı, doğru ve anlaşılır yanıtlar verirsin
- Bilmediğin konularda bunu açıkça belirtirsin

İLETİŞİM TARZI:
- Profesyonel ama samimi bir dil kullan
- Teknik terimleri açıklarken anlaşılır ol
- Sorulara detaylı ve yapıcı cevaplar ver
- Gerektiğinde örnekler ve açıklamalar ekle

DAVRANIŞIN:
- Bilmediğin konularda "Bu konuda kesin bilgim yok" diyerek dürüst ol
- Yanlış bilgi vermektense araştırma öner
- Kullanıcının seviyesine uygun açıklamalar yap
- Sorun çözme odaklı yaklaş"""

RAG_MODE_SYSTEM_PROMPT = """Sen bir yapay zeka asistanısın ve şu anda RAG (Retrieval-Augmented Generation) modunda çalışıyorsun.

RAG MODUNDA GÖREVIN:
- Yüklenen dökümanlardan bilgi çekerek sorulara cevap veriyorsun
- Sadece döküman içeriğine dayalı bilgiler veriyorsun
- Kaynak belirtmeyi unutmuyorsun
- Döküman içinde bulamadığın bilgiler için "Bu bilgi dökümanlar arasında bulunmuyor" diyorsun

CEVAP FORMATTIN:
1. Soruya doğrudan cevap ver
2. Hangi döküman(lar)dan bilgi aldığını belirt
3. Gerekirse alıntı yap
4. Ek açıklama gerekiyorsa ekle

ÖRNEK:
"Dökümanlarınıza göre, [konu] hakkında şu bilgiler mevcut: [bilgi]. Bu bilgi [döküman adı] dosyasından alınmıştır."
"""

CHAT_MODE_SYSTEM_PROMPT = """
🗣️ CHAT MODU - Normal Sohbet:
- Döküman tabanlı değil, genel bilgi ve deneyimle cevap veriyorsun
- Günlük konuşma tarzında, samimi ama profesyonel ol
- Teknik sorularda genel bilgilerini kullan, spesifik döküman referansı yapma
- Müşteri sorularını çözmek için elinden geleni yap

💬 KONUŞMA TARZI:
- "Merhaba! Size nasıl yardımcı olabilirim?"
- "Size daha iyi yardımcı olabilmek için..."

🚫 YAPMA:
- Döküman referansı yapma
- "Belgelerinize göre" gibi ifadeler kullanma
"""

def get_system_prompt(mode: str = "chat", has_documents: bool = False) -> str:
    """
    Get appropriate system prompt based on chat mode and document availability.
    NOTE: For per-tenant customization, use the Agent model's system_prompt field instead.
    
    Args:
        mode: "chat" or "rag"  
        has_documents: Whether there are processed documents available
    """
    
    base_prompt = RAGLEAF_DEFAULT_SYSTEM_PROMPT
    
    if mode == "rag" and has_documents:
        return f"{base_prompt}\n\n{RAG_MODE_SYSTEM_PROMPT}"
    elif mode == "chat":
        return f"{base_prompt}\n\n{CHAT_MODE_SYSTEM_PROMPT}"
    else:
        # Default to chat mode if no documents available
        return f"{base_prompt}\n\n{CHAT_MODE_SYSTEM_PROMPT}"

def format_rag_response(response: str, sources: list = None) -> str:
    """
    Format RAG response with source information
    
    Args:
        response: AI generated response
        sources: List of source documents/chunks
    
    Returns:
        Formatted response with sources
    """
    if not sources:
        return response
    
    formatted_response = response
    
    # Add source information
    if sources:
        source_info = "\n\n📚 **Kaynaklar:**\n"
        for i, source in enumerate(sources, 1):
            if isinstance(source, dict):
                file_name = source.get('file', 'Bilinmeyen döküman')
                score = source.get('score', 0)
                source_info += f"{i}. {file_name} (Benzerlik: {score:.2f})\n"
            else:
                source_info += f"{i}. {source}\n"
        
        formatted_response += source_info
    
    return formatted_response

def get_turkish_error_messages() -> dict:
    """Get Turkish error messages for common scenarios"""
    return {
        "no_documents": "Üzgünüm, henüz yüklenmiş döküman bulunmuyor. Lütfen önce döküman yükleyiniz.",
        "no_relevant_docs": "Sorunuzla ilgili bilgi dökümanlar arasında bulunamadı. Farklı kelimeler kullanarak tekrar deneyebilirsiniz.",
        "processing_error": "Döküman işlenirken bir hata oluştu. Lütfen tekrar deneyiniz.",
        "model_error": "AI modeli şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyiniz.",
        "general_error": "Bir hata oluştu. Lütfen tekrar deneyiniz veya sistem yöneticisi ile iletişime geçiniz."
    }

def get_welcome_messages() -> dict:
    """Get welcome messages for different modes"""
    return {
        "rag": "Merhaba! Yüklediğiniz dökümanlar hakkında sorularınızı yanıtlamaya hazırım. Size nasıl yardımcı olabilirim?",
        "chat": "Merhaba! Teknik konulardan günlük sorularınıza kadar her konuda size yardımcı olmaya hazırım. Nasıl yardımcı olabilirim?",
        "no_model": "Merhaba! Sistem şu anda hazırlanıyor. Lütfen bir AI modeli seçiniz ve tekrar deneyiniz."
    }
