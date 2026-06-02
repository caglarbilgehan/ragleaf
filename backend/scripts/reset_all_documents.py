"""
Reset All Documents Script
Tüm dokümanları işlenmemiş duruma getirir ve işlenmiş verileri temizler
"""

import os
import sys
import shutil
import logging
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from database.connection import SessionLocal, engine
from database.models import Document

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def reset_chromadb():
    """ChromaDB koleksiyonunu temizle"""
    try:
        import chromadb
        from chromadb.config import Settings
        
        from backend.services.storage_service import get_storage
        _storage = get_storage()
        org_slug = os.getenv('DEFAULT_TENANT_SLUG', 'default')
        chroma_db_path = _storage.get_chroma_dir(org_slug)
        
        if chroma_db_path.exists():
            logger.info(f"🗑️  ChromaDB temizleniyor: {chroma_db_path}")
            
            # ChromaDB client oluştur ve koleksiyonu sil
            client = chromadb.PersistentClient(
                path=str(chroma_db_path),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            # Tüm koleksiyonları listele ve sil
            collections = client.list_collections()
            for collection in collections:
                logger.info(f"  ❌ Koleksiyon siliniyor: {collection.name}")
                client.delete_collection(collection.name)
            
            logger.info("✅ ChromaDB temizlendi")
        else:
            logger.info("ℹ️  ChromaDB bulunamadı, atlanıyor")
            
    except ImportError:
        logger.warning("⚠️  ChromaDB yüklü değil, atlanıyor")
    except Exception as e:
        logger.error(f"❌ ChromaDB temizleme hatası: {e}")

def clean_vector_files():
    """Tüm vector dosyalarını ve metadata'yı temizle"""
    from backend.services.storage_service import get_storage
    _storage = get_storage()
    org_slug = os.getenv('DEFAULT_TENANT_SLUG', 'default')
    documents_dir = _storage.get_document_root(org_slug)
    
    if not documents_dir.exists():
        logger.warning("⚠️  Documents klasörü bulunamadı")
        return
    
    cleaned_count = 0
    
    # Her doküman klasörünü tara
    for doc_folder in documents_dir.iterdir():
        if not doc_folder.is_dir() or not doc_folder.name.startswith("doc_"):
            continue
        
        vectors_folder = doc_folder / "vectors"
        
        if vectors_folder.exists():
            logger.info(f"🗑️  Temizleniyor: {doc_folder.name}/vectors/")
            
            try:
                # vectors klasörünü tamamen sil
                shutil.rmtree(vectors_folder)
                cleaned_count += 1
                logger.info(f"  ✅ Silindi: {vectors_folder}")
            except Exception as e:
                logger.error(f"  ❌ Hata: {e}")
    
    logger.info(f"✅ {cleaned_count} dokümanın vector dosyaları temizlendi")

def reset_database_documents(db: Session):
    """Veritabanındaki tüm dokümanları işlenmemiş duruma getir"""
    try:
        documents = db.query(Document).all()
        
        logger.info(f"🔄 {len(documents)} doküman sıfırlanıyor...")
        
        for doc in documents:
            doc.status = "uploaded"
            doc.processing_stage = None
            doc.processing_progress = 0
            doc.processing_details = None
            doc.processing_logs = None
            doc.total_chunks = None
            doc.ocr_completed = False
            doc.vector_indexed = False
            doc.processed_at = None
            
            logger.info(f"  🔄 Sıfırlandı: {doc.name}")
        
        db.commit()
        logger.info(f"✅ {len(documents)} doküman veritabanında sıfırlandı")
        
    except Exception as e:
        logger.error(f"❌ Veritabanı sıfırlama hatası: {e}")
        db.rollback()
        raise

def main():
    """Ana işlem"""
    logger.info("=" * 60)
    logger.info("🚀 TÜM DOKÜMANLAR SIFIRLANACAK")
    logger.info("=" * 60)
    
    # Onay iste
    response = input("\n⚠️  Bu işlem tüm işlenmiş verileri silecek. Devam edilsin mi? (evet/hayır): ")
    
    if response.lower() not in ['evet', 'e', 'yes', 'y']:
        logger.info("❌ İşlem iptal edildi")
        return
    
    logger.info("\n📋 İşlem Adımları:")
    logger.info("  1. ChromaDB koleksiyonunu temizle")
    logger.info("  2. Vector dosyalarını sil")
    logger.info("  3. Veritabanı kayıtlarını sıfırla")
    logger.info("")
    
    # 1. ChromaDB temizle
    logger.info("=" * 60)
    logger.info("ADIM 1: ChromaDB Temizleme")
    logger.info("=" * 60)
    reset_chromadb()
    
    # 2. Vector dosyalarını temizle
    logger.info("\n" + "=" * 60)
    logger.info("ADIM 2: Vector Dosyaları Temizleme")
    logger.info("=" * 60)
    clean_vector_files()
    
    # 3. Veritabanını sıfırla
    logger.info("\n" + "=" * 60)
    logger.info("ADIM 3: Veritabanı Sıfırlama")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        reset_database_documents(db)
    finally:
        db.close()
    
    # Özet
    logger.info("\n" + "=" * 60)
    logger.info("✅ TÜM İŞLEMLER TAMAMLANDI")
    logger.info("=" * 60)
    logger.info("📊 Özet:")
    logger.info("  ✅ ChromaDB temizlendi")
    logger.info("  ✅ Vector dosyaları silindi")
    logger.info("  ✅ Veritabanı kayıtları sıfırlandı")
    logger.info("")
    logger.info("🎯 Tüm dokümanlar artık 'uploaded' durumunda")
    logger.info("🔄 Dokümanları tekrar işlemek için admin panelini kullanabilirsiniz")
    logger.info("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n❌ İşlem kullanıcı tarafından iptal edildi")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Beklenmeyen hata: {e}")
        sys.exit(1)
