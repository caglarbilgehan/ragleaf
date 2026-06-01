"""
Professional Embedding Service V2
Refactored to use new chunking and vectorstore services
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
from sqlalchemy.orm import Session

from ..database.models import Document
from ..database.models import Document
# Removed top-level imports of heavy services to avoid startup hang
# from .chunking import chunking_service, ChunkingConfig
# from .embedding import embedding_service
# from .vectorstore import vector_store_manager

logger = logging.getLogger(__name__)


class ProfessionalEmbeddingServiceV2:
    """
    Professional embedding service using refactored components
    
    Uses:
    - ChunkingService for text chunking
    - EmbeddingService for embeddings
    - VectorStoreManager for ChromaDB + FAISS
    """
    
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent.parent / "documents"
        
        # Default chunking config
        from .chunking import ChunkingConfig
        self.chunking_config = ChunkingConfig(
            chunk_size=512,
            chunk_overlap=100,
            min_chunk_length=10
        )
        
        # Batch size for embedding
        self.batch_size = 16 # Reduced batch size for better responsiveness
        
        # Task control reference
        self.task_controls = None
    
    def set_task_controls(self, task_controls):
        """Set reference to async processor's task controls"""
        self.task_controls = task_controls

    async def _check_pause_cancel(self, document_id: int):
        """Check if processing should be paused or cancelled"""
        if not self.task_controls or document_id not in self.task_controls:
            return
        
        control = self.task_controls[document_id]
        
        # Check if cancelled
        if control.get("cancelled", False):
            raise asyncio.CancelledError("Embedding generation was cancelled by user")
        
        # Check if paused
        if control.get("paused", False):
            logger.info(f"Document {document_id} embedding paused, waiting for resume...")
            pause_event = control.get("pause_event")
            if pause_event:
                await pause_event.wait()
                # Check again if cancelled while paused
                if control.get("cancelled", False):
                    raise asyncio.CancelledError("Embedding generation was cancelled while paused")
    
    async def process_document(
        self,
        document_id: int,
        text: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Process document with professional embedding pipeline
        """
        return await self.process_document_professional(document_id, text, db)
    
    async def process_document_professional(
        self,
        document_id: int,
        text: str,
        db: Session,
        start_progress: int = 80,
        end_progress: int = 95
    ) -> Dict[str, Any]:
        """
        Process document with professional embedding pipeline
        
        Args:
            document_id: Document database ID
            text: Extracted text content
            db: SQLAlchemy session
        
        Returns:
            Dict with processing results
        """
        try:
            import gc
            logger.info(f"🚀 Starting professional processing for document {document_id}")
            
            # Get document
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return {"success": False, "error": "Document not found"}
            
            # Memory management for large texts
            text_size = len(text)
            logger.info(f"📏 Document text size: {text_size:,} chars")
            
            # For very large documents, use optimized settings
            if text_size > 500000:  # 500KB
                logger.warning(f"⚠️ Large document detected ({text_size:,} chars), using memory-optimized settings")
                from .chunking import ChunkingConfig
                chunking_config = ChunkingConfig(
                    chunk_size=1024,  # Larger chunks = fewer objects
                    chunk_overlap=50,  # Smaller overlap = less memory
                    min_chunk_length=20
                )
                gc.collect()  # Free memory before processing
            elif text_size > 100000:  # 100KB
                logger.info(f"📊 Medium document ({text_size:,} chars), using balanced settings")
                from .chunking import ChunkingConfig
                chunking_config = ChunkingConfig(
                    chunk_size=768,
                    chunk_overlap=75,
                    min_chunk_length=15
                )
            else:
                chunking_config = self.chunking_config
            
            # Update progress - chunking
            document.processing_stage = "chunking"
            curr_progress = start_progress + int((end_progress - start_progress) * 0.1)
            document.processing_progress = curr_progress
            document.processing_details = "Metin parçalara bölünüyor..."
            db.commit()
            
            # Create chunks using ChunkingService
            from .chunking import chunking_service
            chunking_result = chunking_service.chunk(
                text, 
                strategy='paragraph',
                config=chunking_config
            )
            
            # Free original text memory if very large
            if text_size > 500000:
                del text
                gc.collect()
            
            if not chunking_result.chunks:
                return {"success": False, "error": "No valid chunks created"}
            
            chunks = chunking_result.to_dict_list()
            logger.info(f"✂️ Created {len(chunks)} chunks")
            
            # === MULTILINGUAL PROCESSING ===
            # Process chunks for multiple languages if auto-translate is enabled
            from .multilingual_chunking import multilingual_chunking_service
            
            source_language = document.language or "tr"
            logger.info(f"🌍 Document source language: {source_language}")
            
            # Update progress - translation (if needed)
            document.processing_stage = "translation"
            curr_progress = start_progress + int((end_progress - start_progress) * 0.2)
            document.processing_progress = curr_progress
            document.processing_details = "Çok dilli işleme kontrol ediliyor..."
            db.commit()
            
            def translation_progress_callback(message: str):
                document.processing_details = message
                db.commit()
            
            multilingual_result = await multilingual_chunking_service.process_chunks_multilingual(
                document_id=document_id,
                source_chunks=chunks,
                source_language=source_language,
                db=db,
                progress_callback=translation_progress_callback
            )
            
            if multilingual_result.get("success"):
                chunks = multilingual_result.get("all_chunks", chunks)
                logger.info(f"🌍 Multilingual processing complete: {len(chunks)} total chunks")
                logger.info(f"   Source: {multilingual_result.get('source_chunks_count', 0)}, Translated: {multilingual_result.get('translated_chunks_count', 0)}")
                logger.info(f"   Languages: {multilingual_result.get('languages_processed', [])}")
            else:
                logger.warning(f"⚠️ Multilingual processing failed, using source chunks only: {multilingual_result.get('error')}")
            
            # Update progress - embedding
            document.processing_stage = "embedding"
            curr_progress = start_progress + int((end_progress - start_progress) * 0.3)
            document.processing_progress = curr_progress
            document.processing_details = f"{len(chunks)} parça için embedding oluşturuluyor..."
            db.commit()
            
            # Get model info first
            logger.info(f"📊 Getting active embedding model...")
            from .embedding import embedding_service
            model = embedding_service.get_active_model(db)
            logger.info(f"📊 Active model: {model.model_id}, dimension: {model.dimension}")
            
            # Create embeddings using EmbeddingService
            texts = [chunk['text'] for chunk in chunks]
            logger.info(f"📊 Encoding {len(texts)} texts in batches...")
            
            all_embeddings = []
            import asyncio
            
            total_texts = len(texts)
            for i in range(0, total_texts, self.batch_size):
                # Check for cancellation/pause before each batch
                await self._check_pause_cancel(document_id)
                
                batch_texts = texts[i:i + self.batch_size]
                batch_embeddings = embedding_service.encode(
                    texts=batch_texts,
                    db=db,
                    batch_size=len(batch_texts), # Process this batch fully
                    normalize=True
                )
                all_embeddings.append(batch_embeddings)
                
                # Yield to event loop to keep server responsive
                await asyncio.sleep(0.01)
                
                # Update progress during embedding
                batch_progress = curr_progress + int(((end_progress - start_progress) * 0.4) * (min(i + self.batch_size, total_texts) / total_texts))
                document.processing_progress = batch_progress
                document.processing_details = f"Embedding oluşturuluyor: {min(i + self.batch_size, total_texts)}/{total_texts}"
                db.commit()
            
            embeddings = np.vstack(all_embeddings)
            
            dimension = model.dimension
            model_id = model.model_id
            model_db_id = model.id
            
            logger.info(f"🧠 Created embeddings: {embeddings.shape}")
            
            # Update progress - indexing
            document.processing_stage = "indexing"
            document.processing_progress = start_progress + int((end_progress - start_progress) * 0.8)
            document.processing_details = "Vector store'lara ekleniyor..."
            db.commit()
            
            # Add to vector stores using VectorStoreManager
            from .vectorstore import vector_store_manager
            result = vector_store_manager.add_document(
                document_id=document_id,
                document_name=document.name,
                folder_name=document.folder_name,
                chunks=chunks,
                embeddings=embeddings,
                dimension=dimension
            )
            
            if not result.get('success'):
                return {"success": False, "error": result.get('error', 'Vector store failed')}
            
            # Save chunk metadata
            vectors_folder = self.base_dir / document.folder_name / "vectors"
            vectors_folder.mkdir(parents=True, exist_ok=True)
            
            metadata_path = vectors_folder / f"doc_{document_id}_metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'document_id': document_id,
                    'chunks': chunks,
                    'total_chunks': len(chunks),
                    'embedding_model': model_id,
                    'vector_dimension': dimension,
                    'chromadb_count': result.get('chroma_count', 0),
                    'faiss_count': result.get('faiss_count', 0)
                }, f, ensure_ascii=False, indent=2)
            
            # Final update
            document.processing_stage = "completed"
            document.processing_progress = 100
            document.processing_details = f"İşlem tamamlandı! {len(chunks)} parça"
            document.status = "processed"
            document.vector_indexed = True
            document.total_chunks = len(chunks)
            document.embedding_model_id = model_db_id
            db.commit()
            
            logger.info(f"✅ Professional processing completed for document {document_id}")
            
            return {
                "success": True,
                "chunks_created": len(chunks),
                "embeddings_shape": embeddings.shape,
                "chroma_count": result.get('chroma_count', 0),
                "faiss_count": result.get('faiss_count', 0),
                "metadata_path": str(metadata_path)
            }
            
        except Exception as e:
            logger.error(f"❌ Professional processing failed for document {document_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Update document with error
            if 'document' in locals() and document:
                document.status = "error"
                document.processing_details = f"Hata: {str(e)}"
                db.commit()
            
            return {"success": False, "error": str(e)}


# Global instance
professional_embedding_service_v2 = ProfessionalEmbeddingServiceV2()
