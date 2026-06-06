"""
AI Personality and System Prompts for Ragleaf Platform
Per-tenant customization: Each agent/tenant defines their own system prompt via the Agent model.
This module provides generic fallback prompts when no tenant-specific prompt is configured.
"""

RAGLEAF_DEFAULT_SYSTEM_PROMPT_TR = """Sen bir yapay zeka asistanısın.

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

RAGLEAF_DEFAULT_SYSTEM_PROMPT_EN = """You are an AI assistant.

IDENTITY AND ROLE:
- You are a professional AI assistant helping users
- You provide detailed, accurate, and understandable answers
- You explicitly state when you don't know something

COMMUNICATION STYLE:
- Use a professional but friendly tone
- Be clear when explaining technical terms
- Provide detailed and constructive answers
- Add examples and explanations when needed

BEHAVIOR:
- Be honest by saying "I don't have definite information about this" when you don't know
- Suggest research instead of providing incorrect information
- Provide explanations appropriate to the user's level
- Focus on problem-solving"""

RAG_MODE_SYSTEM_PROMPT_TR = """Sen bir yapay zeka asistanısın ve şu anda RAG (Retrieval-Augmented Generation) modunda çalışıyorsun.

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

RAG_MODE_SYSTEM_PROMPT_EN = """You are an AI assistant and currently working in RAG (Retrieval-Augmented Generation) mode.

YOUR ROLE IN RAG MODE:
- You answer questions by extracting information from uploaded documents
- You provide information based only on document content
- You don't forget to cite sources
- For information not found in documents, you say "This information is not found in the documents"

YOUR RESPONSE FORMAT:
1. Answer the question directly
2. Specify which document(s) you got the information from
3. Quote if necessary
4. Add additional explanation if needed

EXAMPLE:
"According to your documents, the following information is available about [topic]: [information]. This information was taken from the [document name] file."
"""

CHAT_MODE_SYSTEM_PROMPT_TR = """
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

CHAT_MODE_SYSTEM_PROMPT_EN = """
🗣️ CHAT MODE - Normal Chat:
- You respond with general knowledge and experience, not document-based
- Use a daily conversational style, friendly but professional
- Use your general knowledge for technical questions, don't make specific document references
- Do your best to solve customer questions

💬 CONVERSATION STYLE:
- "Hello! How can I help you?"
- "To help you better..."

🚫 DON'T:
- Make document references
- Use phrases like "According to your documents"
"""

def get_system_prompt(mode: str = "chat", has_documents: bool = False, language: str = "tr") -> str:
    """
    Get appropriate system prompt based on chat mode, document availability, and language.
    NOTE: For per-tenant customization, use the Agent model's system_prompt field instead.
    
    Args:
        mode: "chat" or "rag"  
        has_documents: Whether there are processed documents available
        language: "tr" for Turkish, "en" for English
    """
    
    # Select base prompt based on language
    base_prompt = RAGLEAF_DEFAULT_SYSTEM_PROMPT_TR if language == "tr" else RAGLEAF_DEFAULT_SYSTEM_PROMPT_EN
    
    # Select mode-specific prompt based on language
    if mode == "rag" and has_documents:
        mode_prompt = RAG_MODE_SYSTEM_PROMPT_TR if language == "tr" else RAG_MODE_SYSTEM_PROMPT_EN
        return f"{base_prompt}\n\n{mode_prompt}"
    elif mode == "chat":
        mode_prompt = CHAT_MODE_SYSTEM_PROMPT_TR if language == "tr" else CHAT_MODE_SYSTEM_PROMPT_EN
        return f"{base_prompt}\n\n{mode_prompt}"
    else:
        # Default to chat mode if no documents available
        mode_prompt = CHAT_MODE_SYSTEM_PROMPT_TR if language == "tr" else CHAT_MODE_SYSTEM_PROMPT_EN
        return f"{base_prompt}\n\n{mode_prompt}"

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

def get_english_error_messages() -> dict:
    """Get English error messages for common scenarios"""
    return {
        "no_documents": "Sorry, no documents have been uploaded yet. Please upload documents first.",
        "no_relevant_docs": "No information related to your question was found in the documents. You can try again using different words.",
        "processing_error": "An error occurred while processing the document. Please try again.",
        "model_error": "The AI model is currently unavailable. Please try again later.",
        "general_error": "An error occurred. Please try again or contact the system administrator."
    }

def get_error_messages(language: str = "tr") -> dict:
    """Get error messages for the specified language"""
    return get_english_error_messages() if language == "en" else get_turkish_error_messages()

def get_welcome_messages(language: str = "tr") -> dict:
    """Get welcome messages for different modes and language"""
    if language == "en":
        return {
            "rag": "Hello! I'm ready to answer your questions about the documents you've uploaded. How can I help you?",
            "chat": "Hello! I'm ready to help you with everything from technical topics to daily questions. How can I help you?",
            "no_model": "Hello! The system is currently preparing. Please select an AI model and try again."
        }
    else:
        return {
            "rag": "Merhaba! Yüklediğiniz dökümanlar hakkında sorularınızı yanıtlamaya hazırım. Size nasıl yardımcı olabilirim?",
            "chat": "Merhaba! Teknik konulardan günlük sorularınıza kadar her konuda size yardımcı olmaya hazırım. Nasıl yardımcı olabilirim?",
            "no_model": "Merhaba! Sistem şu anda hazırlanıyor. Lütfen bir AI modeli seçiniz ve tekrar deneyiniz."
        }
