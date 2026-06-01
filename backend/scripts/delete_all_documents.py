"""
Delete All Documents Script
Tüm dokümanları fiziksel olarak ve veritabanından tamamen siler
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

def delete_chromadb():
    """ChromaDB'yi tamamen sil"""
    try:
        chroma_db_path = Path("./documents/database/chroma_db").resolve()
        
        if chroma_db_path.exists():
            logger.info(f"🗑️  ChromaDB siliniyor: {chroma_db_path}")
            shutil.rmtree(chroma_db_path)
            logger.info("✅ ChromaDB tamamen silindi")
        else:
            logger.info("ℹ️  ChromaDB bulunamadı, atlanıyor")
            
    except Exception as e:
        logger.error(f"❌ ChromaDB silme hatası: {e}")

def delete_all_document_folders():
    """Tüm doküman klasörlerini fiziksel olarak sil"""
    documents_dir = Path("./documents")
    
    if not documents_dir.exists():
        logger.warning("⚠️  Documents klasörü bulunamadı")
        return 0
    
    deleted_count = 0
    
    # Her doküman klasörünü sil
    for doc_folder in documents_dir.iterdir():
        if not doc_folder.is_dir():
            continue
        
        # doc_ ile başlayan klasörleri sil
        if doc_folder.name.startswith("doc_"):
            logger.info(f"🗑️  Siliniyor: {doc_folder.name}")
            
            try:
                shutil.rmtree(doc_folder)
                deleted_count += 1
                logger.info(f"  ✅ Silindi: {doc_folder.name}")
            except Exception as e:
                logger.error(f"  ❌ Hata: {e}")
        
        # database klasörünü de sil (ChromaDB için)
        elif doc_folder.name == "database":
            logger.info(f"🗑️  Siliniyor: {doc_folder.name}")
            try:
                shutil.rmtree(doc_folder)
                logger.info(f"  ✅ Silindi: {doc_folder.name}")
            except Exception as e:
                logger.error(f"  ❌ Hata: {e}")
    
    logger.info(f"✅ {deleted_count} doküman klasörü silindi")
    return deleted_count

def delete_database_documents(db: Session):
    """Veritabanındaki tüm doküman kayıtlarını sil"""
    try:
        documents = db.query(Document).all()
        doc_count = len(documents)
        
        logger.info(f"🗑️  {doc_count} doküman kaydı siliniyor...")
        
        for doc in documents:
            logger.info(f"  ❌ Siliniyor: {doc.name}")
            db.delete(doc)
        
        db.commit()
        logger.info(f"✅ {doc_count} doküman veritabanından silindi")
        return doc_count
        
    except Exception as e:
        logger.error(f"❌ Veritabanı silme hatası: {e}")
        db.rollback()
        raise

def main():
    """Ana işlem"""
    logger.info("=" * 60)
    logger.info("⚠️  TÜM DOKÜMANLAR SİLİNECEK (FİZİKSEL + VERİTABANI)")
    logger.info("=" * 60)
    
    # Onay iste
    logger.info("\n🚨 UYARI: Bu işlem GERİ ALINAMAZ!")
    logger.info("   - Tüm doküman dosyaları silinecek")
    logger.info("   - Tüm işlenmiş veriler silinecek")
    logger.info("   - Tüm veritabanı kayıtları silinecek")
    logger.info("   - ChromaDB tamamen silinecek")
    
    response = input("\n⚠️  Devam etmek istediğinizden emin misiniz? (EVET yazın): ")
    
    if response != 'EVET':
        logger.info("❌ İşlem iptal edildi")
        return
    
    # İkinci onay
    response2 = input("\n⚠️  Son onay: Tüm dokümanlar silinecek. Devam? (evet/hayır): ")
    
    if response2.lower() not in ['evet', 'e', 'yes', 'y']:
        logger.info("❌ İşlem iptal edildi")
        return
    
    logger.info("\n📋 İşlem Adımları:")
    logger.info("  1. ChromaDB'yi tamamen sil")
    logger.info("  2. Tüm doküman klasörlerini sil")
    logger.info("  3. Veritabanı kayıtlarını sil")
    logger.info("")
    
    # 1. ChromaDB sil
    logger.info("=" * 60)
    logger.info("ADIM 1: ChromaDB Silme")
    logger.info("=" * 60)
    delete_chromadb()
    
    # 2. Doküman klasörlerini sil
    logger.info("\n" + "=" * 60)
    logger.info("ADIM 2: Doküman Klasörleri Silme")
    logger.info("=" * 60)
    folder_count = delete_all_document_folders()
    
    # 3. Veritabanını temizle
    logger.info("\n" + "=" * 60)
    logger.info("ADIM 3: Veritabanı Temizleme")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        db_count = delete_database_documents(db)
    finally:
        db.close()
    
    # Özet
    logger.info("\n" + "=" * 60)
    logger.info("✅ TÜM İŞLEMLER TAMAMLANDI")
    logger.info("=" * 60)
    logger.info("📊 Özet:")
    logger.info(f"  ✅ {folder_count} doküman klasörü silindi")
    logger.info(f"  ✅ {db_count} veritabanı kaydı silindi")
    logger.info("  ✅ ChromaDB tamamen silindi")
    logger.info("")
    logger.info("🎯 Sistem temiz! Yeni dokümanlar yükleyebilirsiniz.")
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
