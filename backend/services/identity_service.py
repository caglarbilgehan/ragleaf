"""
Identity Service
Ragleaf AI kimlik sorularını tespit eden ve yanıtlayan servis
"""

import re
from typing import Optional, Dict, Any

class IdentityService:
    """Ragleaf AI kimlik yönetimi"""
    
    def __init__(self):
        # Identity detection patterns (Turkish)
        self.identity_patterns = [
            r'\b(sen\s+kim(sin|iz)?)\b',
            r'\b(kim(sin|iz)\s+sen)\b', 
            r'\b(adın\s+ne)\b',
            r'\b(ne\s+adın)\b',
            r'\b(kendini\s+tanıt)\b',
            r'\b(kendini\s+tanıtır\s+mısın)\b',
            r'\b(hangi\s+asistan)\b',
            r'\b(ne\s+tür\s+asistan)\b',
            r'\b(yapay\s+zeka\s+mısın)\b',
            r'\b(ai\s+mısın)\b',
            r'\b(bot\s+musun)\b',
            r'\b(asistan\s+mısın)\b',
            r'\b(kim\s+olduğunu\s+söyle)\b',
            r'\b(kendinden\s+bahset)\b',
            r'\b(hakkında\s+bilgi\s+ver)\b',
            r'\b(who\s+are\s+you)\b',
            r'\b(what\s+is\s+your\s+name)\b'
        ]
        
        # Compiled patterns for better performance
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.identity_patterns]
    
    def is_identity_question(self, message: str) -> bool:
        """Check if the message is asking about identity"""
        message_clean = message.strip().lower()
        
        # Check against all patterns
        for pattern in self.compiled_patterns:
            if pattern.search(message_clean):
                return True
        
        return False
    
    def get_identity_response(self, mode: str = "chat") -> str:
        """Get appropriate identity response based on mode"""
        
        base_identity = """Ben bir **AI Asistanı**yım. Size yardımcı olmak için buradayım.

🤖 **Kimliğim:**
• Ragleaf AI Asistanı
• Profesyonel ve güvenilir AI asistanı
• Kurumsal çözümler sunan yapay zeka
• Çok dilli destek ile hizmet veren asistan

💼 **Görevim:**
• Size profesyonel destek sağlamak
• Sorularınızı net ve anlaşılır şekilde yanıtlamak
• Kurumsal standartlarda hizmet sunmak
• Güvenilir ve doğru bilgiler vermek"""

        if mode == "rag":
            rag_addition = """

📚 **RAG Döküman Modunda:**
• Yüklenen dökümanları analiz ederim
• Sadece döküman içeriğine dayalı yanıtlar veririm
• Kaynak bilgilerini detaylı şekilde belirtirim
• Görsel içerikleri de işleyebilirim"""
            
            return base_identity + rag_addition
        
        else:  # chat mode
            chat_addition = """

💬 **Sohbet Modunda:**
• Genel konularda size yardımcı olurum
• Geniş bilgi birikimimi kullanırım
• İnteraktif sohbet deneyimi sunarım
• Çeşitli konularda destek sağlarım"""
            
            return base_identity + chat_addition
    
    def get_identity_response_with_suggestions(self, mode: str = "chat") -> str:
        """Get identity response with question suggestions"""
        
        base_response = self.get_identity_response(mode)
        
        if mode == "rag":
            suggestions = """

💡 **Size Nasıl Yardımcı Olabilirim:**
• Dökümanlarınızda belirli bilgileri arayabilirim
• Teknik prosedürleri açıklayabilirim
• Güvenlik önlemlerini detaylandırabilirim
• Kurulum adımlarını rehberlik edebilirim"""
        else:
            suggestions = """

💡 **Size Nasıl Yardımcı Olabilirim:**
• Teknik sorularınızı yanıtlayabilirim
• Genel bilgilendirme yapabilirim
• Problem çözme konusunda destek verebilirim
• Çeşitli konularda rehberlik edebilirim"""
        
        return base_response + suggestions

# Global instance
identity_service = IdentityService()
