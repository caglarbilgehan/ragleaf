"""
Document Storage Management Service
Handles organized file structure for documents
"""

import os
import json
import shutil
import hashlib
import re
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Turkish character mapping for filename cleaning
TURKISH_CHAR_MAP = {
    'ş': 's', 'Ş': 'S',
    'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U',
    'ö': 'o', 'Ö': 'O',
    'ç': 'c', 'Ç': 'C',
    'ı': 'i', 'İ': 'I'
}


def clean_turkish_chars(text: str) -> str:
    """Replace Turkish characters with ASCII equivalents"""
    for tr_char, ascii_char in TURKISH_CHAR_MAP.items():
        text = text.replace(tr_char, ascii_char)
    return text


class DocumentStorage:
    def __init__(self, base_path: str = None):
        if base_path is None:
            base_path = Path(__file__).parent.parent.parent / "documents"
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)
        
    def generate_document_folder_name(self, doc_number: int, filename: str) -> str:
        """Generate folder name: 0001_filename format"""
        clean_name = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
        clean_name = clean_name.replace(' ', '_')
        if '.' in clean_name:
            clean_name = clean_name.rsplit('.', 1)[0]
        match = re.match(r'^doc_\d+_\d+_(.+)$', clean_name)
        if match:
            clean_name = match.group(1)
        clean_name = clean_turkish_chars(clean_name)
        if len(clean_name) > 100:
            clean_name = clean_name[:100]
        return f"{doc_number:04d}_{clean_name}"
    
    def create_document_structure(self, doc_number: int, filename: str) -> Dict[str, Path]:
        """Create folder structure for document"""
        folder_name = self.generate_document_folder_name(doc_number, filename)
        doc_path = self.base_path / folder_name
        doc_path.mkdir(exist_ok=True)
        structure = {
            'root': doc_path,
            'original': doc_path / 'original',
            'processed': doc_path / 'processed',
            'chunks': doc_path / 'processed' / 'chunks',
            'vectors': doc_path / 'vectors',
            'images': doc_path / 'images',
            'analysis': doc_path / 'analysis'
        }
        for folder_path in structure.values():
            folder_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created document structure: {folder_name}")
        return structure


    def save_original_file(self, document_id: int, filename: str, source_path: str) -> Dict[str, Any]:
        """Save original file to document structure"""
        try:
            structure = self.create_document_structure(document_id, filename)
            original_file_path = structure['original'] / filename
            shutil.copy2(source_path, original_file_path)
            file_hash = self._calculate_file_hash(original_file_path)
            metadata = {
                "document_info": {
                    "id": document_id,
                    "folder_name": structure['root'].name,
                    "display_name": Path(filename).stem,
                    "original_filename": filename,
                    "file_type": Path(filename).suffix.lower().lstrip('.'),
                    "file_size": original_file_path.stat().st_size,
                    "file_hash": file_hash,
                    "upload_date": datetime.now().isoformat(),
                    "processed_date": None
                },
                "processing_info": {
                    "status": "uploaded",
                    "total_pages": None,
                    "total_chunks": None,
                    "total_images": None,
                    "ocr_completed": False,
                    "vector_indexed": False,
                    "processing_time_seconds": None
                },
                "paths": {
                    "root": str(structure['root']),
                    "original_file": str(original_file_path),
                    "metadata_file": str(structure['root'] / 'metadata.json')
                }
            }
            self.save_metadata(structure['root'], metadata)
            return {
                "success": True,
                "folder_name": structure['root'].name,
                "structure": {k: str(v) for k, v in structure.items()},
                "metadata": metadata
            }
        except Exception as e:
            logger.error(f"Error saving original file: {e}")
            return {"success": False, "error": str(e)}
    
    def save_processed_content(self, folder_name: str, content: str, content_type: str = "text") -> bool:
        """Save processed content"""
        try:
            doc_path = self.base_path / folder_name
            if not doc_path.exists():
                raise Exception(f"Document folder not found: {folder_name}")
            if content_type == "text":
                file_path = doc_path / 'processed' / 'text_content.txt'
            elif content_type == "ocr":
                file_path = doc_path / 'processed' / 'full_text.txt'
            else:
                file_path = doc_path / 'processed' / f'{content_type}_content.txt'
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info(f"Saved {content_type} content for {folder_name}")
            return True
        except Exception as e:
            logger.error(f"Error saving processed content: {e}")
            return False
    
    def save_chunks(self, folder_name: str, chunks: List[str]) -> bool:
        """Save text chunks"""
        try:
            doc_path = self.base_path / folder_name
            chunks_path = doc_path / 'processed' / 'chunks'
            for i, chunk in enumerate(chunks):
                chunk_file = chunks_path / f'chunk_{i+1:03d}.txt'
                with open(chunk_file, 'w', encoding='utf-8') as f:
                    f.write(chunk)
            chunks_index = {
                "total_chunks": len(chunks),
                "chunk_files": [f'chunk_{i+1:03d}.txt' for i in range(len(chunks))],
                "created_at": datetime.now().isoformat()
            }
            index_file = chunks_path / 'chunks_index.json'
            with open(index_file, 'w', encoding='utf-8') as f:
                json.dump(chunks_index, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved {len(chunks)} chunks for {folder_name}")
            return True
        except Exception as e:
            logger.error(f"Error saving chunks: {e}")
            return False
    
    def save_vectors(self, folder_name: str, embeddings, vector_metadata: Dict[str, Any]) -> bool:
        """Save vector embeddings"""
        try:
            import numpy as np
            doc_path = self.base_path / folder_name
            vectors_path = doc_path / 'vectors'
            vectors_path.mkdir(parents=True, exist_ok=True)
            embeddings_file = vectors_path / 'embeddings.npy'
            np.save(embeddings_file, embeddings)
            metadata_file = vectors_path / 'vector_metadata.json'
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(vector_metadata, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved vectors for {folder_name}")
            return True
        except Exception as e:
            logger.error(f"Error saving vectors: {e}")
            return False
    
    def save_metadata(self, doc_path: Path, metadata: Dict[str, Any]) -> bool:
        """Save document metadata"""
        try:
            metadata_file = doc_path / 'metadata.json'
            metadata["last_updated"] = datetime.now().isoformat()
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")
            return False
    
    def load_metadata(self, folder_name: str) -> Optional[Dict[str, Any]]:
        """Load document metadata"""
        try:
            doc_path = self.base_path / folder_name
            metadata_file = doc_path / 'metadata.json'
            if not metadata_file.exists():
                return None
            with open(metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
            return None
    
    def update_processing_status(self, folder_name: str, status: str, details: Dict[str, Any] = None) -> bool:
        """Update processing status"""
        try:
            metadata = self.load_metadata(folder_name)
            if not metadata:
                return False
            metadata["processing_info"]["status"] = status
            if details:
                metadata["processing_info"].update(details)
            if status == "processed":
                metadata["document_info"]["processed_date"] = datetime.now().isoformat()
            doc_path = self.base_path / folder_name
            return self.save_metadata(doc_path, metadata)
        except Exception as e:
            logger.error(f"Error updating processing status: {e}")
            return False
    
    def get_document_path(self, folder_name: str) -> Optional[Path]:
        """Get document root path"""
        doc_path = self.base_path / folder_name
        return doc_path if doc_path.exists() else None
    
    def get_original_file_path(self, folder_name: str) -> Optional[Path]:
        """Get original file path"""
        doc_path = self.get_document_path(folder_name)
        if not doc_path:
            return None
        original_path = doc_path / 'original'
        if not original_path.exists():
            return None
        files = list(original_path.glob('*'))
        return files[0] if files else None
    
    def delete_document(self, folder_name: str) -> bool:
        """Delete document folder"""
        try:
            doc_path = self.base_path / folder_name
            if doc_path.exists():
                shutil.rmtree(doc_path)
                logger.info(f"Deleted document folder: {folder_name}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """List all documents"""
        documents = []
        try:
            for doc_folder in self.base_path.iterdir():
                if doc_folder.is_dir() and (doc_folder.name.startswith('doc_') or re.match(r'^\d{4}_', doc_folder.name)):
                    metadata = self.load_metadata(doc_folder.name)
                    if metadata:
                        documents.append({"folder_name": doc_folder.name, "metadata": metadata})
            return documents
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            total_size = 0
            document_count = 0
            for doc_folder in self.base_path.iterdir():
                if doc_folder.is_dir() and (doc_folder.name.startswith('doc_') or re.match(r'^\d{4}_', doc_folder.name)):
                    document_count += 1
                    for file_path in doc_folder.rglob('*'):
                        if file_path.is_file():
                            total_size += file_path.stat().st_size
            return {
                "total_documents": document_count,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "base_path": str(self.base_path)
            }
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {}
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()


# Global instance
document_storage = DocumentStorage()
