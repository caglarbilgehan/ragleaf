"""
Token Service - Get API tokens from AI services
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session
from ..database.models import Settings, AIProvider, AIToken

logger = logging.getLogger(__name__)

class TokenService:
    """Service to get API tokens from AI services configuration"""
    
    # Provider name mapping
    PROVIDER_MAPPING = {
        'huggingface': 'huggingface',
        'openai': 'openai', 
        'anthropic': 'anthropic',
        'google': 'google',
        'cohere': 'cohere',
        'mistral': 'mistral',
        'deepseek': 'deepseek'
    }
    
    @staticmethod
    def get_token_for_provider(db: Session, provider: str) -> Optional[str]:
        """Get primary token for provider from ai_tokens table (priority-based)"""
        try:
            # Map provider name to service name
            service_name = TokenService.PROVIDER_MAPPING.get(provider.lower(), provider.lower())
            
            # First, find the provider in ai_provider table
            ai_provider = db.query(AIProvider).filter(
                AIProvider.name == service_name,
                AIProvider.is_active == True
            ).first()
            
            if not ai_provider:
                logger.warning(f"No active provider found for: {service_name}")
                return None
            
            # Get active tokens for this provider, sorted by priority
            tokens = db.query(AIToken).filter(
                AIToken.provider_id == ai_provider.id,
                AIToken.is_active == True
            ).order_by(AIToken.priority.asc()).all()
            
            if tokens:
                # Get the highest priority token (lowest priority number)
                primary_token = tokens[0]
                logger.info(f"Using {provider} token: {primary_token.display_name} (Priority: {primary_token.priority})")
                return primary_token.api_key_plain
            
            logger.warning(f"No active tokens found for provider: {service_name}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting {provider} token: {e}")
            return None
    
    @staticmethod
    def get_huggingface_token(db: Session) -> Optional[str]:
        """Get primary HuggingFace token from AI services (backward compatibility)"""
        return TokenService.get_token_for_provider(db, 'huggingface')
    
    @staticmethod
    def get_service_token(db: Session, service_name: str) -> Optional[str]:
        """Get token for any AI service by name (alias for get_token_for_provider)"""
        return TokenService.get_token_for_provider(db, service_name)

# Global instance
token_service = TokenService()
