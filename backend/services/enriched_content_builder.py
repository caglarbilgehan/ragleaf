"""
Enriched Content Builder Service
Builds enriched content strings for embedding generation by combining:
- Original chunk content
- Suggested questions
- Tags
- Special instructions
- Linked image OCR texts and captions
- Document enrichments (JSON/QA)

This enriched content is then used to generate embeddings that capture
all the semantic information from both the original text and enrichments.
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Default max length for enriched content (characters)
# Most embedding models have max_sequence_length around 512 tokens
# Assuming ~4 chars per token, 512 tokens ≈ 2048 chars
# We use 8192 as a safe upper limit for longer context models
DEFAULT_MAX_LENGTH = 8192


@dataclass
class EnrichmentData:
    """Data class for chunk enrichment data"""
    suggested_questions: List[str] = None
    tags: List[str] = None
    special_instructions: str = None
    
    def __post_init__(self):
        self.suggested_questions = self.suggested_questions or []
        self.tags = self.tags or []
        self.special_instructions = self.special_instructions or ""


@dataclass
class LinkedAsset:
    """Data class for linked image/asset data"""
    asset_id: int
    ocr_text: Optional[str] = None
    caption: Optional[str] = None


@dataclass
class DocumentEnrichmentData:
    """Data class for document-level enrichment"""
    enrichment_type: str  # 'json' or 'qa'
    title: str
    content: str


class EnrichedContentBuilder:
    """
    Builds enriched content strings for embedding generation.
    
    The enriched content follows this format:
    ---
    [Original Content]
    
    Önerilen Sorular:
    - Soru 1
    - Soru 2
    
    Etiketler: tag1, tag2, tag3
    
    Özel Talimatlar:
    [instructions]
    
    Görsel İçerik:
    [Görsel X]: OCR text
    [Açıklama]: Caption
    
    Döküman Zenginleştirmeleri:
    [JSON] Title: Content
    [S&C] Question: Answer
    ---
    """
    
    SECTION_SEPARATOR = "\n\n---\n\n"
    QUESTIONS_HEADER = "Önerilen Sorular:"
    TAGS_HEADER = "Etiketler:"
    INSTRUCTIONS_HEADER = "Özel Talimatlar:"
    VISUAL_HEADER = "Görsel İçerik:"
    ENRICHMENTS_HEADER = "Döküman Zenginleştirmeleri:"
    
    def __init__(self, max_length: int = DEFAULT_MAX_LENGTH):
        """
        Initialize the builder.
        
        Args:
            max_length: Maximum length for enriched content (characters)
        """
        self.max_length = max_length
    
    def build_enriched_content(
        self,
        original_content: str,
        enrichment_data: Optional[EnrichmentData] = None,
        linked_assets: Optional[List[LinkedAsset]] = None,
        document_enrichments: Optional[List[DocumentEnrichmentData]] = None
    ) -> str:
        """
        Build enriched content string from chunk and related data.
        
        Args:
            original_content: Original chunk text content
            enrichment_data: Chunk-level enrichment (questions, tags, instructions)
            linked_assets: List of linked images with OCR/captions
            document_enrichments: Document-level enrichments (JSON/QA)
        
        Returns:
            Enriched content string ready for embedding
        """
        if not original_content:
            logger.warning("⚠️ Empty original content provided")
            return ""
        
        sections = []
        
        # 1. Original content (always first)
        sections.append(original_content.strip())
        
        # 2. Suggested questions
        if enrichment_data and enrichment_data.suggested_questions:
            questions_section = self._build_questions_section(
                enrichment_data.suggested_questions
            )
            if questions_section:
                sections.append(questions_section)
        
        # 3. Tags
        if enrichment_data and enrichment_data.tags:
            tags_section = self._build_tags_section(enrichment_data.tags)
            if tags_section:
                sections.append(tags_section)
        
        # 4. Special instructions
        if enrichment_data and enrichment_data.special_instructions:
            instructions_section = self._build_instructions_section(
                enrichment_data.special_instructions
            )
            if instructions_section:
                sections.append(instructions_section)
        
        # 5. Linked image content (OCR + captions)
        if linked_assets:
            visual_section = self._build_visual_section(linked_assets)
            if visual_section:
                sections.append(visual_section)
        
        # 6. Document enrichments (JSON/QA)
        if document_enrichments:
            enrichments_section = self._build_document_enrichments_section(
                document_enrichments
            )
            if enrichments_section:
                sections.append(enrichments_section)
        
        # Join sections with separator
        enriched_content = self.SECTION_SEPARATOR.join(sections)
        
        # Truncate if necessary
        enriched_content = self._truncate_to_max_length(enriched_content)
        
        logger.debug(
            f"📝 Built enriched content: {len(original_content)} → {len(enriched_content)} chars"
        )
        
        return enriched_content
    
    def _build_questions_section(self, questions: List[str]) -> str:
        """Build the suggested questions section"""
        if not questions:
            return ""
        
        lines = [self.QUESTIONS_HEADER]
        for q in questions:
            if q and q.strip():
                lines.append(f"- {q.strip()}")
        
        return "\n".join(lines) if len(lines) > 1 else ""
    
    def _build_tags_section(self, tags: List[str]) -> str:
        """Build the tags section"""
        if not tags:
            return ""
        
        # Filter empty tags and join with commas
        valid_tags = [t.strip() for t in tags if t and t.strip()]
        if not valid_tags:
            return ""
        
        return f"{self.TAGS_HEADER} {', '.join(valid_tags)}"
    
    def _build_instructions_section(self, instructions: str) -> str:
        """Build the special instructions section"""
        if not instructions or not instructions.strip():
            return ""
        
        return f"{self.INSTRUCTIONS_HEADER}\n{instructions.strip()}"
    
    def _build_visual_section(self, assets: List[LinkedAsset]) -> str:
        """Build the visual content section from linked images"""
        if not assets:
            return ""
        
        lines = [self.VISUAL_HEADER]
        
        for asset in assets:
            if asset.ocr_text and asset.ocr_text.strip():
                lines.append(f"[Görsel {asset.asset_id}]: {asset.ocr_text.strip()}")
            if asset.caption and asset.caption.strip():
                lines.append(f"[Açıklama]: {asset.caption.strip()}")
        
        return "\n".join(lines) if len(lines) > 1 else ""
    
    def _build_document_enrichments_section(
        self, 
        enrichments: List[DocumentEnrichmentData]
    ) -> str:
        """Build the document enrichments section"""
        if not enrichments:
            return ""
        
        lines = [self.ENRICHMENTS_HEADER]
        
        for e in enrichments:
            if e.enrichment_type == "json":
                lines.append(f"[JSON] {e.title}: {e.content}")
            elif e.enrichment_type == "qa":
                lines.append(f"[S&C] {e.title}: {e.content}")
            else:
                lines.append(f"[{e.enrichment_type.upper()}] {e.title}: {e.content}")
        
        return "\n".join(lines) if len(lines) > 1 else ""
    
    def _truncate_to_max_length(self, content: str) -> str:
        """
        Truncate content to fit max_length.
        
        Truncation strategy:
        1. If content fits, return as-is
        2. Otherwise, truncate from the end with ellipsis
        3. Try to truncate at a section boundary if possible
        """
        if len(content) <= self.max_length:
            return content
        
        logger.warning(
            f"⚠️ Content exceeds max length ({len(content)} > {self.max_length}), truncating"
        )
        
        # Try to find a good truncation point (section separator)
        truncate_at = self.max_length - 3  # Leave room for "..."
        
        # Look for last section separator before truncate point
        last_separator = content.rfind(self.SECTION_SEPARATOR, 0, truncate_at)
        
        if last_separator > self.max_length // 2:
            # Found a good separator point in the second half
            return content[:last_separator] + "..."
        
        # No good separator, just truncate
        return content[:truncate_at] + "..."
    
    def build_from_chunk_dict(
        self,
        chunk_content: str,
        enrichment_data_dict: Optional[Dict[str, Any]] = None,
        image_relations: Optional[List[int]] = None,
        assets_by_id: Optional[Dict[int, Dict[str, Any]]] = None,
        document_enrichments: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Convenience method to build enriched content from dictionary data.
        
        This is useful when working directly with database query results.
        
        Args:
            chunk_content: Original chunk text
            enrichment_data_dict: Dict with suggested_questions, tags, special_instructions
            image_relations: List of asset IDs linked to this chunk
            assets_by_id: Dict mapping asset_id to asset data (ocr_text, caption)
            document_enrichments: List of dicts with type, title, content
        
        Returns:
            Enriched content string
        """
        # Convert enrichment data dict to dataclass
        enrichment = None
        if enrichment_data_dict:
            enrichment = EnrichmentData(
                suggested_questions=enrichment_data_dict.get("suggested_questions", []),
                tags=enrichment_data_dict.get("tags", []),
                special_instructions=enrichment_data_dict.get("special_instructions", "")
            )
        
        # Convert linked assets
        linked_assets = []
        if image_relations and assets_by_id:
            for asset_id in image_relations:
                if asset_id in assets_by_id:
                    asset_data = assets_by_id[asset_id]
                    linked_assets.append(LinkedAsset(
                        asset_id=asset_id,
                        ocr_text=asset_data.get("ocr_text"),
                        caption=asset_data.get("caption")
                    ))
        
        # Convert document enrichments
        doc_enrichments = []
        if document_enrichments:
            for e in document_enrichments:
                doc_enrichments.append(DocumentEnrichmentData(
                    enrichment_type=e.get("type", "unknown"),
                    title=e.get("title", ""),
                    content=e.get("content", "")
                ))
        
        return self.build_enriched_content(
            original_content=chunk_content,
            enrichment_data=enrichment,
            linked_assets=linked_assets if linked_assets else None,
            document_enrichments=doc_enrichments if doc_enrichments else None
        )


# Global instance for convenience
enriched_content_builder = EnrichedContentBuilder()
