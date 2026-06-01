"""
Embedding Model Manager
Handles embedding model changes and automatic vector database reset.
"""

import os
import shutil
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from pathlib import Path

from ..database.models import EmbeddingModel, Document, Settings

logger = logging.getLogger(__name__)


class EmbeddingModelManager:
    """
    Manages embedding model changes and ensures vector database consistency.
    When embedding model changes, automatically:
    1. Detects dimension mismatch
    2. Clears ChromaDB and FAISS vectors
    3. Resets document processing status
    4. Notifies about required reprocessing
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.documents_root = Path(os.getenv("DOCUMENTS_ROOT", "./documents"))
        self.chroma_dir = self.documents_root / "database" / "chroma_db"
    
    def get_current_model_info(self) -> Optional[Dict[str, Any]]:
        """Get current default embedding model info"""
        model = self.db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True,
            EmbeddingModel.is_active == True
        ).first()
        
        if model:
            return {
                "id": model.id,  # Integer database ID
                "model_id": model.model_id,  # String model identifier
                "dimension": model.dimension,
                "display_name": model.display_name
            }
        return None
    
    def get_model_db_id(self, model_id: str) -> Optional[int]:
        """Get integer database ID from model_id string"""
        model = self.db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == model_id
        ).first()
        return model.id if model else None
    
    def get_stored_model_info(self) -> Optional[Dict[str, Any]]:
        """Get stored model info from settings (last used model for vectors)"""
        setting = self.db.query(Settings).filter(
            Settings.key == "active_embedding_model"
        ).first()
        
        if setting and setting.value:
            return setting.value
        return None
    
    def save_model_info(self, model_info: Dict[str, Any]) -> None:
        """Save current model info to settings"""
        setting = self.db.query(Settings).filter(
            Settings.key == "active_embedding_model"
        ).first()
        
        if setting:
            setting.value = model_info
            setting.description = "Aktif embedding modeli bilgisi (vektör veritabanı uyumluluğu için)"
        else:
            setting = Settings(
                key="active_embedding_model",
                value=model_info,
                description="Aktif embedding modeli bilgisi (vektör veritabanı uyumluluğu için)"
            )
            self.db.add(setting)
        
        self.db.commit()
    
    def check_model_compatibility(self, new_model_id: str) -> Dict[str, Any]:
        """
        Check if new model is compatible with existing vectors.
        
        Returns:
            dict with:
            - compatible: bool
            - requires_reset: bool
            - reason: str
            - old_model: dict or None
            - new_model: dict or None
        """
        logger.info(f"🔍 check_model_compatibility: new_model_id={new_model_id}")
        
        # Get new model info
        new_model = self.db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == new_model_id
        ).first()
        
        if not new_model:
            logger.warning(f"⚠️ Model bulunamadı: {new_model_id}")
            return {
                "compatible": False,
                "requires_reset": False,
                "reason": f"Model bulunamadı: {new_model_id}",
                "old_model": None,
                "new_model": None
            }
        
        new_model_info = {
            "model_id": new_model.model_id,
            "dimension": new_model.dimension,
            "display_name": new_model.display_name
        }
        
        # Get stored model info
        stored_info = self.get_stored_model_info()
        logger.info(f"📊 Kayıtlı model bilgisi: {stored_info}")
        
        # If no stored info, this is first time - no reset needed
        if not stored_info:
            logger.info(f"ℹ️ İlk model kurulumu - reset gerekmez")
            return {
                "compatible": True,
                "requires_reset": False,
                "reason": "İlk model kurulumu",
                "old_model": None,
                "new_model": new_model_info
            }
        
        # Check if same model
        if stored_info.get("model_id") == new_model_id:
            logger.info(f"ℹ️ Aynı model zaten aktif")
            return {
                "compatible": True,
                "requires_reset": False,
                "reason": "Aynı model zaten aktif",
                "old_model": stored_info,
                "new_model": new_model_info
            }
        
        # Check dimension compatibility
        old_dimension = stored_info.get("dimension", 0)
        new_dimension = new_model.dimension
        
        logger.info(f"📐 Boyut karşılaştırması: eski={old_dimension}, yeni={new_dimension}")
        
        if old_dimension != new_dimension:
            logger.info(f"⚠️ Boyut uyumsuz - reset gerekli")
            return {
                "compatible": False,
                "requires_reset": True,
                "reason": f"Embedding boyutu uyumsuz: {old_dimension} → {new_dimension}. Vektör veritabanı sıfırlanmalı.",
                "old_model": stored_info,
                "new_model": new_model_info
            }
        
        # Different model but same dimension - still needs reset for consistency
        logger.info(f"⚠️ Farklı model - reset gerekli")
        return {
            "compatible": False,
            "requires_reset": True,
            "reason": f"Farklı model: {stored_info.get('model_id')} → {new_model_id}. Tutarlılık için vektör veritabanı sıfırlanmalı.",
            "old_model": stored_info,
            "new_model": new_model_info
        }
    
    def clear_chroma_db(self) -> Dict[str, Any]:
        """Clear ChromaDB database"""
        try:
            if self.chroma_dir.exists():
                # Delete all contents
                for item in self.chroma_dir.iterdir():
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                
                logger.info(f"✅ ChromaDB temizlendi: {self.chroma_dir}")
                return {"success": True, "message": "ChromaDB temizlendi"}
            else:
                return {"success": True, "message": "ChromaDB klasörü mevcut değil"}
        except Exception as e:
            logger.error(f"❌ ChromaDB temizleme hatası: {e}")
            return {"success": False, "message": str(e)}
    
    def adjust_vector_column_dimension(self, new_dimension: int) -> Dict[str, Any]:
        """
        Adjust PostgreSQL vector column dimension for new embedding model.
        This is required when switching to a model with different dimension.
        """
        try:
            from sqlalchemy import text
            
            # First truncate document_chunks (required before ALTER COLUMN on vector type)
            self.db.execute(text('TRUNCATE TABLE document_chunks CASCADE'))
            logger.info(f"📦 document_chunks tablosu temizlendi")
            
            # Alter vector column to new dimension
            self.db.execute(text(f'ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector({new_dimension})'))
            self.db.commit()
            
            logger.info(f"✅ Vektör kolonu boyutu güncellendi: vector({new_dimension})")
            return {"success": True, "new_dimension": new_dimension}
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Vektör kolonu boyutu güncelleme hatası: {e}")
            return {"success": False, "message": str(e)}
    
    def clear_faiss_vectors(self, new_model_id: str = None) -> Dict[str, Any]:
        """
        Clear FAISS vectors from document folders.
        If new_model_id is provided, only clear vectors for documents with different embedding model.
        """
        try:
            cleared_count = 0
            
            # Get list of documents to clear (if filtering by model)
            docs_to_clear = set()
            if new_model_id:
                # Get integer DB ID from model_id string
                new_model_db_id = self.get_model_db_id(new_model_id)
                # Support new pipeline statuses: indexed, enriched, processed
                docs = self.db.query(Document).filter(
                    Document.status.in_(["indexed", "enriched", "processed"]),
                    Document.vector_indexed == True,
                    (Document.embedding_model_id != new_model_db_id) | 
                    (Document.embedding_model_id == None)
                ).all()
                docs_to_clear = {doc.folder_name for doc in docs}
            
            # Find all vectors directories
            for doc_dir in self.documents_root.iterdir():
                if doc_dir.is_dir():
                    # If filtering, only clear matching documents
                    if new_model_id and doc_dir.name not in docs_to_clear:
                        continue
                    
                    vectors_dir = doc_dir / "vectors"
                    if vectors_dir.exists():
                        shutil.rmtree(vectors_dir)
                        vectors_dir.mkdir(exist_ok=True)  # Recreate empty
                        cleared_count += 1
            
            logger.info(f"✅ {cleared_count} döküman için FAISS vektörleri temizlendi")
            return {"success": True, "cleared_count": cleared_count}
        except Exception as e:
            logger.error(f"❌ FAISS temizleme hatası: {e}")
            return {"success": False, "message": str(e)}
    
    def reset_document_status(self, new_model_id: str = None) -> Dict[str, Any]:
        """
        Reset documents to 'uploaded' status.
        If new_model_id is provided, only reset documents processed with a different model.
        """
        try:
            # Build query for documents to reset
            # Support new pipeline statuses: indexed, enriched, processed
            query = self.db.query(Document).filter(
                Document.status.in_(["indexed", "enriched", "processed"]),
                Document.vector_indexed == True
            )
            
            # If new model specified, only reset documents with different embedding model
            if new_model_id:
                # Get integer DB ID from model_id string
                new_model_db_id = self.get_model_db_id(new_model_id)
                query = query.filter(
                    (Document.embedding_model_id != new_model_db_id) | 
                    (Document.embedding_model_id == None)
                )
            
            # Get count before update
            docs_to_reset = query.all()
            reset_count = len(docs_to_reset)
            
            if reset_count > 0:
                # Reset each document
                for doc in docs_to_reset:
                    # Get old model name for logging
                    old_model_name = "bilinmiyor"
                    if doc.embedding_model_id:
                        old_model = self.db.query(EmbeddingModel).filter(EmbeddingModel.id == doc.embedding_model_id).first()
                        if old_model:
                            old_model_name = old_model.display_name
                    
                    doc.status = "uploaded"
                    doc.processing_stage = None
                    doc.processing_progress = 0
                    doc.processing_details = f"Embedding modeli değişti ({old_model_name} → {new_model_id}) - yeniden işleme gerekli"
                    doc.vector_indexed = False
                    doc.embedding_model_id = None
                    # Keep ocr_completed and processed text - only reset vectors
                
                self.db.commit()
                logger.info(f"✅ {reset_count} döküman durumu sıfırlandı (uyumsuz embedding modeli)")
            else:
                logger.info(f"✅ Sıfırlanacak döküman yok - tüm dökümanlar uyumlu")
            
            return {"success": True, "reset_count": reset_count}
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Döküman durumu sıfırlama hatası: {e}")
            return {"success": False, "message": str(e)}
    
    def perform_full_reset(self, new_model_id: str) -> Dict[str, Any]:
        """
        Perform full vector database reset for model change.
        
        Steps:
        1. Clear ChromaDB
        2. Clear FAISS vectors
        3. Reset document status
        4. Save new model info
        """
        logger.info(f"🔄 Embedding modeli değişikliği için tam sıfırlama başlatılıyor: {new_model_id}")
        
        results = {
            "success": True,
            "steps": [],
            "new_model_id": new_model_id
        }
        
        # Step 1: Clear ChromaDB
        chroma_result = self.clear_chroma_db()
        results["steps"].append({
            "step": "ChromaDB Temizleme",
            "result": chroma_result
        })
        if not chroma_result.get("success"):
            results["success"] = False
        
        # Step 2: Clear FAISS vectors (only for documents with different embedding model)
        faiss_result = self.clear_faiss_vectors(new_model_id)
        results["steps"].append({
            "step": "FAISS Vektörleri Temizleme",
            "result": faiss_result
        })
        if not faiss_result.get("success"):
            results["success"] = False
        
        # Step 3: Adjust PostgreSQL vector column dimension
        new_model = self.db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == new_model_id
        ).first()
        
        if new_model:
            vector_result = self.adjust_vector_column_dimension(new_model.dimension)
            results["steps"].append({
                "step": "Vektör Kolonu Boyutu Güncelleme",
                "result": vector_result
            })
            if not vector_result.get("success"):
                results["success"] = False
        
        # Step 4: Reset document status (only documents with different embedding model)
        doc_result = self.reset_document_status(new_model_id)
        results["steps"].append({
            "step": "Döküman Durumları Sıfırlama",
            "result": doc_result
        })
        if not doc_result.get("success"):
            results["success"] = False
        
        # Step 4: Save new model info
        if results["success"]:
            new_model = self.db.query(EmbeddingModel).filter(
                EmbeddingModel.model_id == new_model_id
            ).first()
            
            if new_model:
                self.save_model_info({
                    "model_id": new_model.model_id,
                    "dimension": new_model.dimension,
                    "display_name": new_model.display_name
                })
                results["steps"].append({
                    "step": "Yeni Model Bilgisi Kaydetme",
                    "result": {"success": True}
                })
        
        if results["success"]:
            logger.info(f"✅ Tam sıfırlama tamamlandı. Yeni model: {new_model_id}")
        else:
            logger.error(f"❌ Tam sıfırlama başarısız")
        
        return results
    
    def change_embedding_model(
        self, 
        new_model_id: str, 
        auto_reset: bool = True,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Change embedding model with automatic reset if needed.
        
        Args:
            new_model_id: New model ID to activate
            auto_reset: Automatically reset vectors if incompatible
            force: Force reset even if compatible
            
        Returns:
            dict with change results
        """
        logger.info(f"🔄 change_embedding_model çağrıldı: new_model_id={new_model_id}, auto_reset={auto_reset}, force={force}")
        
        # Check compatibility
        compatibility = self.check_model_compatibility(new_model_id)
        logger.info(f"📊 Uyumluluk kontrolü: {compatibility}")
        
        result = {
            "success": False,
            "message": "",
            "compatibility": compatibility,
            "reset_performed": False,
            "documents_affected": 0
        }
        
        # If compatible and not forcing, just update default
        if compatibility["compatible"] and not force:
            logger.info(f"✅ Model uyumlu, sadece varsayılan güncelleniyor")
            # Update default model in database
            self._set_default_model(new_model_id)
            
            result["success"] = True
            result["message"] = compatibility["reason"]
            return result
        
        # If requires reset
        if compatibility["requires_reset"]:
            logger.info(f"🔄 Reset gerekli, auto_reset={auto_reset}")
            if auto_reset:
                # Perform full reset
                reset_result = self.perform_full_reset(new_model_id)
                logger.info(f"📊 Reset sonucu: {reset_result}")
                result["reset_performed"] = True
                result["reset_details"] = reset_result
                
                if reset_result["success"]:
                    # Update default model
                    self._set_default_model(new_model_id)
                    
                    # Count affected documents
                    doc_count = self.db.query(Document).count()
                    result["documents_affected"] = doc_count
                    
                    result["success"] = True
                    result["message"] = f"Embedding modeli değiştirildi ve vektör veritabanı sıfırlandı. {doc_count} döküman yeniden işlenmeyi bekliyor."
                else:
                    result["success"] = False
                    result["message"] = "Vektör veritabanı sıfırlama başarısız"
            else:
                result["success"] = False
                result["message"] = f"Model değişikliği vektör sıfırlama gerektiriyor: {compatibility['reason']}"
                result["requires_confirmation"] = True
        
        return result
    
    def _set_default_model(self, model_id: str) -> None:
        """Set model as default in database"""
        # Unset current default
        self.db.query(EmbeddingModel).filter(
            EmbeddingModel.is_default == True
        ).update({"is_default": False})
        
        # Set new default
        self.db.query(EmbeddingModel).filter(
            EmbeddingModel.model_id == model_id
        ).update({"is_default": True})
        
        self.db.commit()
        logger.info(f"✅ Varsayılan embedding modeli değiştirildi: {model_id}")


def get_embedding_model_manager(db: Session) -> EmbeddingModelManager:
    """Get embedding model manager instance"""
    return EmbeddingModelManager(db)
