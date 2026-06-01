# backend/utils/snapshots.py
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

def ensure_snapshots_dir() -> Path:
    """Snapshots klasörünü oluştur ve path döndür"""
    snapshots_dir = Path("data/snapshots")
    snapshots_dir.mkdir(parents=True, exist_ok=True)
    return snapshots_dir

def save_json_snapshot(data: Dict[str, Any], filename_prefix: str = "chat") -> str:
    """
    Chat veya diğer verileri JSON snapshot olarak kaydet
    
    Args:
        data: Kaydedilecek veri
        filename_prefix: Dosya adı prefix'i
        
    Returns:
        Kaydedilen dosyanın path'i
    """
    try:
        snapshots_dir = ensure_snapshots_dir()
        
        # Timestamp ile unique filename oluştur
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # millisecond precision
        filename = f"{filename_prefix}_{timestamp}.json"
        filepath = snapshots_dir / filename
        
        # Metadata ekle
        snapshot_data = {
            "timestamp": datetime.now().isoformat(),
            "type": filename_prefix,
            "data": data
        }
        
        # JSON olarak kaydet
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=2, ensure_ascii=False)
        
        return str(filepath)
        
    except Exception as e:
        print(f"Snapshot kaydetme hatası: {e}")
        return ""

def load_json_snapshot(filepath: str) -> Optional[Dict[str, Any]]:
    """JSON snapshot dosyasını yükle"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Snapshot yükleme hatası: {e}")
        return None

def list_snapshots(snapshot_type: Optional[str] = None) -> list:
    """Mevcut snapshot'ları listele"""
    try:
        snapshots_dir = ensure_snapshots_dir()
        snapshots = []
        
        for file in snapshots_dir.glob("*.json"):
            if snapshot_type and not file.name.startswith(f"{snapshot_type}_"):
                continue
                
            try:
                stat = file.stat()
                snapshots.append({
                    "filename": file.name,
                    "filepath": str(file),
                    "size_bytes": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": file.name.split("_")[0] if "_" in file.name else "unknown"
                })
            except Exception:
                continue
        
        # En yeni önce sırala
        snapshots.sort(key=lambda x: x["modified"], reverse=True)
        return snapshots
        
    except Exception as e:
        print(f"Snapshot listeleme hatası: {e}")
        return []

def cleanup_old_snapshots(days: int = 30, snapshot_type: Optional[str] = None) -> int:
    """Eski snapshot'ları temizle"""
    try:
        snapshots_dir = ensure_snapshots_dir()
        cutoff_time = datetime.now().timestamp() - (days * 24 * 60 * 60)
        deleted_count = 0
        
        for file in snapshots_dir.glob("*.json"):
            if snapshot_type and not file.name.startswith(f"{snapshot_type}_"):
                continue
                
            try:
                if file.stat().st_mtime < cutoff_time:
                    file.unlink()
                    deleted_count += 1
            except Exception:
                continue
        
        return deleted_count
        
    except Exception as e:
        print(f"Snapshot temizleme hatası: {e}")
        return 0
