"""
Chunk File Service
Chunk'ları ayrı dosyalar olarak kaydeden servis
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ChunkFileService:
    """Chunk'ları ayrı dosyalar olarak yöneten servis"""
    
    def __init__(self):
        # Use absolute path to root documents folder
        self.base_dir = Path(__file__).parent.parent.parent / "documents"
    
    async def save_chunks_as_files(
        self, 
        document_folder: str,
        chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Chunk'ları ayrı dosyalar olarak kaydet"""
        
        try:
            doc_folder = self.base_dir / document_folder
            chunks_folder = doc_folder / "processed" / "chunks"
            
            chunks_folder.mkdir(parents=True, exist_ok=True)
            
            saved_files = []
            
            for i, chunk in enumerate(chunks):
                try:
                    # Create chunk filename
                    chunk_id = chunk.get('id', i)
                    filename = f"chunk_{chunk_id:03d}.txt"
                    chunk_file = chunks_folder / filename
                    
                    # Prepare chunk content
                    chunk_text = chunk.get('text', '')
                    chunk_metadata = {
                        'id': chunk.get('id', i),
                        'length': chunk.get('length', len(chunk_text)),
                        'word_count': chunk.get('word_count', len(chunk_text.split())),
                        'paragraph_index': chunk.get('paragraph_index', 0),
                        'has_images': chunk.get('has_images', False),
                        'image_count': chunk.get('image_count', 0)
                    }
                    
                    # Create file content
                    file_content = f"""CHUNK #{chunk_id:03d}
{'=' * 50}

METADATA:
{json.dumps(chunk_metadata, ensure_ascii=False, indent=2)}

CONTENT:
{'=' * 50}
{chunk_text}

{'=' * 50}
END OF CHUNK #{chunk_id:03d}
"""
                    
                    # Save chunk file
                    with open(chunk_file, 'w', encoding='utf-8') as f:
                        f.write(file_content)
                    
                    saved_files.append({
                        'chunk_id': chunk_id,
                        'filename': filename,
                        'file_size': chunk_file.stat().st_size,
                        'text_length': len(chunk_text)
                    })
                    
                except Exception as e:
                    logger.error(f"Error saving chunk {i}: {e}")
                    continue
            
            # Create chunks index
            index_content = {
                'total_chunks': len(chunks),
                'saved_files': len(saved_files),
                'files': saved_files,
                'created_at': str(Path().cwd())  # Timestamp placeholder
            }
            
            index_file = chunks_folder / "chunks_index.json"
            with open(index_file, 'w', encoding='utf-8') as f:
                json.dump(index_content, f, ensure_ascii=False, indent=2)
            
            # Create README
            readme_content = f"""# CHUNKS FOLDER

Bu klasör dökümanın metin parçalarını (chunks) içerir.

## İçerik:
- Toplam chunk sayısı: {len(chunks)}
- Kaydedilen dosya sayısı: {len(saved_files)}

## Dosya Formatı:
- chunk_001.txt, chunk_002.txt, ...
- Her dosya chunk metadata + içerik
- chunks_index.json: Tüm chunk'ların özeti

## Kullanım:
- Debugging ve analiz için
- Chunk-level inceleme
- Metin kalitesi kontrolü

## Oluşturulma:
- Professional Document Processor tarafından
- Embedding işlemi sonrası
"""
            
            readme_file = chunks_folder / "README.md"
            with open(readme_file, 'w', encoding='utf-8') as f:
                f.write(readme_content)
            
            return {
                "success": True,
                "total_chunks": len(chunks),
                "saved_files": len(saved_files),
                "chunks_folder": str(chunks_folder)
            }
            
        except Exception as e:
            logger.error(f"Error in save_chunks_as_files: {e}")
            return {"success": False, "error": str(e)}
    
    async def load_chunk_from_file(
        self, 
        document_folder: str, 
        chunk_id: int
    ) -> Optional[Dict[str, Any]]:
        """Belirli bir chunk'ı dosyadan yükle"""
        
        try:
            doc_folder = self.base_dir / document_folder
            chunks_folder = doc_folder / "processed" / "chunks"
            
            chunk_file = chunks_folder / f"chunk_{chunk_id:03d}.txt"
            
            if not chunk_file.exists():
                return None
            
            with open(chunk_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse content (basic parsing)
            lines = content.split('\n')
            chunk_text = ""
            in_content = False
            
            for line in lines:
                if line.startswith("CONTENT:"):
                    in_content = True
                    continue
                elif line.startswith("=" * 50) and in_content:
                    break
                elif in_content:
                    chunk_text += line + "\n"
            
            return {
                "id": chunk_id,
                "text": chunk_text.strip(),
                "source": "file",
                "file_path": str(chunk_file)
            }
            
        except Exception as e:
            logger.error(f"Error loading chunk {chunk_id}: {e}")
            return None

# Global instance
chunk_file_service = ChunkFileService()
