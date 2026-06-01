"""
File System Cleaner Service
Handles deletion of document folders and files
"""
import logging
import shutil
from pathlib import Path
from decouple import config

logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path(config("DOCUMENTS_DIR", default="documents"))


class FileSystemCleaner:
    """Service for cleaning file system folders"""
    
    async def delete_folder(self, document_id: int, folder_name: str, document_folder: str) -> bool:
        """Delete a specific folder within document directory"""
        try:
            doc_folder = DOCUMENTS_DIR / document_folder
            folder_path = doc_folder / folder_name
            
            if folder_path.exists():
                shutil.rmtree(folder_path)
                logger.info(f"🗑️ Deleted folder: {folder_path}")
                return True
            else:
                logger.info(f"ℹ️ Folder does not exist: {folder_path}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error deleting folder {folder_name}: {e}")
            raise
    
    async def delete_all_except_original(self, document_id: int, document_folder: str) -> list:
        """Delete all folders except 'original'"""
        try:
            doc_folder = DOCUMENTS_DIR / document_folder
            
            if not doc_folder.exists():
                logger.warning(f"⚠️ Document folder does not exist: {doc_folder}")
                return []
            
            folders_to_delete = ['processed', 'images', 'vectors', 'analysis']
            deleted_folders = []
            
            for folder_name in folders_to_delete:
                folder_path = doc_folder / folder_name
                if folder_path.exists():
                    shutil.rmtree(folder_path)
                    deleted_folders.append(folder_name)
                    logger.info(f"🗑️ Deleted folder: {folder_path}")
            
            logger.info(f"🗑️ Deleted {len(deleted_folders)} folders for document {document_id}")
            return deleted_folders
            
        except Exception as e:
            logger.error(f"❌ Error deleting folders: {e}")
            raise
